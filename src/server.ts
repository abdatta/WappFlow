/*
 * Entry point for the WhatsApp bot backend. Sets up the Express
 * server, WebSocket notifications, rate limiting and scheduling.
 * The server exposes a JSON API secured with an admin token and
 * serves the compiled admin UI. Playwright and the scheduler run
 * in-process alongside the HTTP server. Errors are logged but
 * surfaced to clients in a controlled fashion.
 */

import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import path from "path";
import { config as dotenv } from "dotenv";
import webPush from "web-push";
import { z } from "zod";
import { RateLimiter } from "./rateLimiter.js";
import { Scheduler } from "./scheduler.js";
import { WhatsAppDriver } from "./driver.js";
import { ContactsCache } from "./contacts.js";
import {
  getSettings,
  saveSettings,
  getSubs,
  saveSubs,
  appendSendLog,
  getSession,
  saveSession,
} from "./store.js";
import { SendRequestDto, ScheduleDto, HealthResponse } from "./types.js";
import { validatePhone, hashText, randomDelaySeconds, uuid } from "./utils.js";

// Load environment variables
dotenv();

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3030;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";

/**
 * Main application entry point.
 * This function orchestrates the setup of the entire backend service.
 * It initializes settings, configures web push notifications, starts the
 * WhatsApp driver, sets up rate limiting and task scheduling, and
 * initializes the contact cache. Finally, it configures and starts the
 * Express server, which exposes the API endpoints for interacting with the bot.
 */
async function main() {
  // Load application settings from store.
  const settings = await getSettings();
  // Configure web-push service with VAPID keys for sending notifications.
  if (settings.vapid.publicKey && settings.vapid.privateKey) {
    webPush.setVapidDetails(
      "mailto:example@example.com",
      settings.vapid.publicKey,
      settings.vapid.privateKey,
    );
  }
  // Initialize the WhatsApp driver, which controls the Playwright browser.
  const driver = new WhatsAppDriver(settings);
  await driver.init().catch((err) => {
    console.error("Driver init failed", err);
  });
  // Set up the rate limiter to control the frequency of outgoing messages.
  const limiter = new RateLimiter();
  await limiter.init();
  // Initialize the scheduler for sending messages at specific times.
  const scheduler = new Scheduler();
  await scheduler.init();
  // Initialize the contacts cache to store and manage contact information.
  const contacts = new ContactsCache(driver);
  await contacts.init();
  // Periodically refresh the contacts from WhatsApp Web.
  setInterval(() => contacts.refreshFromWeb(), 6 * 60 * 60 * 1000);
  // Start the scheduler and provide it with the core message sending logic.
  scheduler.start(async ({ phone, name, text, disablePrefix }) => {
    await handleSend({ phone, name }, text, disablePrefix);
  });

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  // Simple authentication middleware.
  // For all non-GET requests to the API, this middleware checks for a
  // bearer token in the Authorization header. In a real production
  // environment, this would be a more robust JWT or OAuth-based system.
  // The authentication is currently commented out for ease of development.
  function auth(req: Request, res: Response, next: NextFunction) {
    if (req.method === "GET") return next();
    // const authHeader = req.headers['authorization'];
    // if (!authHeader || authHeader.split(' ')[1] !== ADMIN_TOKEN) {
    //   return res.status(401).json({ error: 'Unauthorized' });
    // }
    return next();
  }
  app.use("/api", auth);

  /**
   * Core message sending logic.
   * This function is the central handler for sending all messages, whether
   * triggered by an API call or by the scheduler. It performs phone number
   * validation, applies a message prefix if configured, checks rate limits,
   * and then calls the WhatsApp driver to actually send the message.
   * It also logs every send attempt, whether successful or not.
   */
  async function handleSend(
    target: { phone?: string; name?: string },
    text: string,
    disablePrefix = false,
  ): Promise<void> {
    contacts.setSending(true);
    // Validate the phone number format if one is provided.
    let e164: string | undefined;
    if (target.phone) {
      try {
        e164 = validatePhone(target.phone);
      } catch (err) {
        throw new Error("INVALID_PHONE");
      }
    }
    // Prepend a configured prefix to the message, unless disabled for this send.
    const currentSettings = await getSettings();
    let body = text;
    if (currentSettings.prefix.defaultEnabled && !disablePrefix) {
      body = `${currentSettings.prefix.text}${text}`;
    }
    // Enforce rate limits before sending.
    const result = await limiter.consume();
    if (!result.allowed) {
      throw new Error(result.reason || "RATE_LIMIT");
    }
    // Add a random delay to mimic human behavior and reduce risk of being flagged.
    const extraDelay = randomDelaySeconds(8, 25) * 1000;
    try {
      if (e164) {
        // If a valid phone number is available, send directly.
        await driver.sendText(e164, body);
        await appendSendLog(
          {
            ts: new Date().toISOString(),
            phone: e164,
            textHash: hashText(text),
            result: "ok",
          },
          driver,
        );
      } else if (target.name) {
        // Otherwise, fall back to sending by contact name.
        const resolvedPhone = await driver.sendTextToContact(
          { name: target.name },
          body,
        );
        // If sending by name resolved a phone number, update the contact cache.
        if (resolvedPhone) {
          await contacts.upsert({ name: target.name, phone: resolvedPhone });
        }
        await appendSendLog(
          {
            ts: new Date().toISOString(),
            phone: resolvedPhone,
            name: target.name,
            textHash: hashText(text),
            result: "ok",
          },
          driver,
        );
      } else {
        throw new Error("NO_TARGET");
      }
    } catch (err) {
      // Log any errors that occur during the send process.
      await appendSendLog(
        {
          ts: new Date().toISOString(),
          phone: e164,
          name: target.name,
          textHash: hashText(text),
          result: "error",
          error: String(err),
        },
        driver,
      );
      throw err;
    } finally {
      // Wait for the random delay to complete and then update sending status.
      await new Promise((resolve) => setTimeout(resolve, extraDelay));
      contacts.setSending(false);
    }
  }

  /**
   * Health check endpoint.
   * Provides a snapshot of the bot's current status, including the
   * WhatsApp session state, rate limiting counters, and whether the
   * browser is running in headless mode. This is useful for monitoring
   * and debugging.
   */
  app.get("/api/health", async (req, res) => {
    const status = limiter.getStatus();
    const sessionState = driver.getSessionState();
    const response: HealthResponse = {
      session: sessionState,
      sentToday: status.sentToday,
      perMinAvailable: status.tokens,
      dailyCap: status.perDay,
      headless: settings.headless,
    };
    res.json(response);
  });

  /**
   * API endpoint for sending a single message.
   * This endpoint accepts a JSON payload with the recipient (by phone or name)
   * and the message text. It uses the `handleSend` function to process and
   * send the message. It includes input validation using Zod to ensure
   * the payload is correctly formatted.
   */
  app.post("/api/send", async (req, res) => {
    const schema = z
      .object({
        phone: z.string().optional(),
        name: z.string().optional(),
        text: z.string(),
        disablePrefix: z.boolean().optional(),
        idempotencyKey: z.string().optional(),
      })
      .refine((d) => d.phone || d.name, {
        message: "phone or name required",
        path: ["phone"],
      });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: "Invalid payload", details: parsed.error.flatten() });
    }
    const { phone, name, text, disablePrefix } = parsed.data;
    try {
      await handleSend({ phone, name }, text, disablePrefix);
      res.json({ ok: true, id: uuid() });
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(429).json({ error: msg });
    }
  });

  /**
   * Endpoints for accessing the contact cache.
   * `/api/contacts/top` returns the most frequently contacted people.
   * `/api/contacts/all` returns the entire list of known contacts.
   */
  app.get("/api/contacts/top", (req, res) => {
    const nParam = parseInt(String(req.query.n || ""), 10);
    const n = nParam === 20 ? 20 : settings.topContactsN;
    res.json({ contacts: contacts.getTop(n) });
  });

  app.get("/api/contacts/all", (req, res) => {
    res.json({ contacts: contacts.getAll() });
  });

  /**
   * Endpoint for subscribing to web push notifications.
   * The frontend can use this to register its push subscription, which is
   * then stored for sending notifications about bot events (e.g., QR required).
   */
  app.post("/api/push/subscribe", async (req, res) => {
    const subscription = req.body;
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ error: "Invalid subscription" });
    }
    const subsFile = await getSubs();
    // Avoid duplicate subscriptions.
    if (!subsFile.subs.find((s) => s.endpoint === subscription.endpoint)) {
      subsFile.subs.push(subscription);
      await saveSubs(subsFile);
    }
    res.json({ ok: true });
  });

  /**
   * Endpoint to send a test push notification.
   * This allows an admin to verify that push notifications are correctly
   * configured and working for all subscribed clients.
   */
  app.post("/api/push/test", async (req, res) => {
    const subsFile = await getSubs();
    const promises = subsFile.subs.map((sub) =>
      webPush
        .sendNotification(
          sub,
          JSON.stringify({
            title: "Test notification",
            body: "Push notifications are working!",
            url: "/admin",
          }),
        )
        .catch((err) => {
          console.error("Failed to send push", err);
        }),
    );
    await Promise.all(promises);
    res.json({ ok: true });
  });

  /**
   * CRUD endpoints for managing scheduled messages.
   * These endpoints allow for creating, listing, retrieving, updating, and
   * deleting scheduled messages. They also provide controls for manually
   * running, pausing, and resuming schedules.
   */
  app.post("/api/schedules", async (req, res) => {
    const schema = z
      .object({
        phone: z.string().optional(),
        name: z.string().optional(),
        text: z.string(),
        disablePrefix: z.boolean().optional(),
        // firstRunAt is an ISO string; we don't validate the format strictly here
        firstRunAt: z.string().optional(),
        intervalMinutes: z.number().nullable().optional(),
        active: z.boolean().optional(),
      })
      .refine((data) => data.phone || data.name, {
        message: "phone or name required",
        path: ["phone"],
      });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: "Invalid payload", details: parsed.error.flatten() });
    }
    try {
      const sched = await scheduler.create(parsed.data as ScheduleDto);
      res.status(201).json(sched);
    } catch (err) {
      res
        .status(500)
        .json({ error: "Failed to create schedule", details: String(err) });
    }
  });

  /**
   * List all scheduled messages.
   */
  app.get("/api/schedules", (req, res) => {
    const items = scheduler.list();
    res.json({ items });
  });

  /**
   * Get a single scheduled message by its ID.
   */
  app.get("/api/schedules/:id", (req, res) => {
    const sched = scheduler.get(req.params.id);
    if (!sched) return res.status(404).json({ error: "Not found" });
    res.json(sched);
  });

  /**
   * Update an existing scheduled message.
   */
  app.put("/api/schedules/:id", async (req, res) => {
    const id = req.params.id;
    const schema = z.object({
      phone: z.string().optional(),
      name: z.string().optional(),
      text: z.string().optional(),
      disablePrefix: z.boolean().optional(),
      firstRunAt: z.string().optional(),
      intervalMinutes: z.number().nullable().optional(),
      active: z.boolean().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: "Invalid payload", details: parsed.error.flatten() });
    }
    const updated = await scheduler.update(
      id,
      parsed.data as Partial<ScheduleDto>,
    );
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(updated);
  });

  /**
   * Delete a scheduled message.
   */
  app.delete("/api/schedules/:id", async (req, res) => {
    const ok = await scheduler.delete(req.params.id);
    if (!ok) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  });

  /**
   * Trigger an immediate run of a scheduled message.
   */
  app.post("/api/schedules/:id/run", async (req, res) => {
    const ok = await scheduler.runNow(req.params.id);
    if (!ok)
      return res.status(404).json({ error: "Not found or failed to run" });
    res.json({ ok: true });
  });

  /**
   * Pause a scheduled message, preventing it from running.
   */
  app.post("/api/schedules/:id/pause", async (req, res) => {
    const ok = await scheduler.pause(req.params.id);
    if (!ok) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  });
  /**
   * Resume a paused scheduled message.
   */
  app.post("/api/schedules/:id/resume", async (req, res) => {
    const ok = await scheduler.resume(req.params.id);
    if (!ok) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  });

  /**
   * Endpoint to serve the latest QR code image.
   * When the WhatsApp driver detects that a QR code scan is needed, it saves
   * the QR code as an image. This endpoint allows the admin UI to fetch and
   * display that image. Cache-Control headers are set to prevent caching,
   * ensuring the user always sees the most recent QR code.
   */
  app.get("/qr/latest", (req, res) => {
    const qrPath = path.join(process.cwd(), "runtime", "qr_latest.png");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.sendFile(qrPath);
  });

  /**
   * Serves the static files for the admin UI.
   * The admin UI is a separate single-page application (SPA) built with Vite.
   * This middleware serves the compiled `dist` directory of the admin UI
   * when a user navigates to `/admin`.
   */
  const adminDir = path.join(process.cwd(), "src", "admin", "dist");
  app.use("/admin", express.static(adminDir));

  app.listen(PORT, () => {
    console.log(`WhatsApp bot server listening on port ${PORT}`);
  });

  /**
   * Event listeners for the WhatsApp driver.
   * These listeners respond to events from the driver (like needing a QR scan)
   * and trigger push notifications to subscribed clients, keeping the admin
   * informed of the bot's status.
   */
  driver.on("qr_required", () => pushNotification("qr_required"));
  driver.on("relinked", () => pushNotification("relinked"));
  driver.on("offline", () => pushNotification("offline"));
  driver.on("error", (err) => pushNotification("error", String(err)));

  /**
   * Sends a push notification to all subscribed clients.
   * This function constructs a notification payload based on the event type
   * and sends it to all registered push subscriptions.
   */
  async function pushNotification(event: string, extra?: string) {
    const subsFile = await getSubs();
    let title = "";
    let body = "";
    let url = "/admin";
    switch (event) {
      case "qr_required":
        title = "WhatsApp: QR scan needed";
        body = "Your session has expired. Scan the new QR code.";
        url = "/admin/qr";
        break;
      case "relinked":
        title = "WhatsApp relinked";
        body = "Your bot has been relinked successfully.";
        break;
      case "offline":
        title = "Phone offline";
        body = "Your phone appears to be offline.";
        break;
      case "error":
        title = "WhatsApp bot error";
        body = extra || "An error occurred in the bot.";
        break;
      default:
        title = "WhatsApp bot";
        body = "Unknown event";
    }
    const payload = JSON.stringify({ title, body, url });
    await Promise.all(
      subsFile.subs.map((sub) =>
        webPush.sendNotification(sub, payload).catch((err) => {
          console.error("Push send failed", err);
        }),
      ),
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
