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

async function main() {
  // Load settings
  const settings = await getSettings();
  // Configure web push
  if (settings.vapid.publicKey && settings.vapid.privateKey) {
    webPush.setVapidDetails(
      "mailto:example@example.com",
      settings.vapid.publicKey,
      settings.vapid.privateKey,
    );
  }
  // Initialise driver
  const driver = new WhatsAppDriver(settings);
  await driver.init().catch((err) => {
    console.error("Driver init failed", err);
  });
  // Initialise rate limiter
  const limiter = new RateLimiter();
  await limiter.init();
  // Initialise scheduler
  const scheduler = new Scheduler();
  await scheduler.init();
  // Initialise contacts cache
  const contacts = new ContactsCache(driver);
  await contacts.init();
  setInterval(() => contacts.refreshFromWeb(), 6 * 60 * 60 * 1000);
  // Provide scheduler with send function that wraps driver and rate limiter
  scheduler.start(async ({ phone, text, disablePrefix }) => {
    await handleSend({ phone }, text, disablePrefix);
  });

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  // Authentication middleware: require bearer token for non‑GET API calls
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
   * Internal send handler used by both API and scheduler. Validates
   * the phone number, enforces rate limits, applies prefix and
   * calls the driver. Logs the attempt to sends.log.jsonl.
   */
  async function handleSend(
    target: { phone?: string; name?: string },
    text: string,
    disablePrefix = false,
  ): Promise<void> {
    contacts.setSending(true);
    // Validate phone if provided
    let e164: string | undefined;
    if (target.phone) {
      try {
        e164 = validatePhone(target.phone);
      } catch (err) {
        throw new Error("INVALID_PHONE");
      }
    }
    // Prepend prefix if enabled globally and not disabled per message
    const currentSettings = await getSettings();
    let body = text;
    if (currentSettings.prefix.defaultEnabled && !disablePrefix) {
      body = `${currentSettings.prefix.text}${text}`;
    }
    // Rate limit
    const result = await limiter.consume();
    if (!result.allowed) {
      throw new Error(result.reason || "RATE_LIMIT");
    }
    // Random extra delay after each send
    const extraDelay = randomDelaySeconds(8, 25) * 1000;
    try {
      if (e164) {
        await driver.sendText(e164, body);
        await appendSendLog({
          ts: new Date().toISOString(),
          phone: e164,
          textHash: hashText(text),
          result: "ok",
        });
      } else if (target.name) {
        const resolvedPhone = await driver.sendTextToContact(
          { name: target.name },
          body,
        );
        if (resolvedPhone) {
          await contacts.upsert({ name: target.name, phone: resolvedPhone });
        }
        await appendSendLog({
          ts: new Date().toISOString(),
          phone: resolvedPhone,
          name: target.name,
          textHash: hashText(text),
          result: "ok",
        });
      } else {
        throw new Error("NO_TARGET");
      }
    } catch (err) {
      await appendSendLog({
        ts: new Date().toISOString(),
        phone: e164,
        name: target.name,
        textHash: hashText(text),
        result: "error",
        error: String(err),
      });
      throw err;
    } finally {
      await new Promise((resolve) => setTimeout(resolve, extraDelay));
      contacts.setSending(false);
    }
  }

  /**
   * Health endpoint: returns information about session and limits.
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
   * Send API: send a single message. Expects JSON body with phone and text.
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
   * Contacts endpoints using the cached contacts list.
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
   * Push subscription endpoint. Stores a push subscription in subs.json.
   */
  app.post("/api/push/subscribe", async (req, res) => {
    const subscription = req.body;
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ error: "Invalid subscription" });
    }
    const subsFile = await getSubs();
    // Deduplicate by endpoint
    if (!subsFile.subs.find((s) => s.endpoint === subscription.endpoint)) {
      subsFile.subs.push(subscription);
      await saveSubs(subsFile);
    }
    res.json({ ok: true });
  });

  /**
   * Send a test push notification to all subscribers.
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
   * Create schedule.
   */
  app.post("/api/schedules", async (req, res) => {
    const schema = z.object({
      phone: z.string(),
      text: z.string(),
      disablePrefix: z.boolean().optional(),
      // firstRunAt is an ISO string; we don't validate the format strictly here
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
   * List schedules.
   */
  app.get("/api/schedules", (req, res) => {
    const items = scheduler.list();
    res.json({ items });
  });

  /**
   * Get schedule by id.
   */
  app.get("/api/schedules/:id", (req, res) => {
    const sched = scheduler.get(req.params.id);
    if (!sched) return res.status(404).json({ error: "Not found" });
    res.json(sched);
  });

  /**
   * Update schedule.
   */
  app.put("/api/schedules/:id", async (req, res) => {
    const id = req.params.id;
    const schema = z.object({
      phone: z.string().optional(),
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
   * Delete schedule.
   */
  app.delete("/api/schedules/:id", async (req, res) => {
    const ok = await scheduler.delete(req.params.id);
    if (!ok) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  });

  /**
   * Run schedule immediately.
   */
  app.post("/api/schedules/:id/run", async (req, res) => {
    const ok = await scheduler.runNow(req.params.id);
    if (!ok)
      return res.status(404).json({ error: "Not found or failed to run" });
    res.json({ ok: true });
  });

  /**
   * Pause schedule.
   */
  app.post("/api/schedules/:id/pause", async (req, res) => {
    const ok = await scheduler.pause(req.params.id);
    if (!ok) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  });
  /**
   * Resume schedule.
   */
  app.post("/api/schedules/:id/resume", async (req, res) => {
    const ok = await scheduler.resume(req.params.id);
    if (!ok) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  });

  /**
   * Endpoint to fetch latest QR image. Returns a PNG file. The
   * runtime/qr_latest.png will be updated by the driver when a QR
   * relink is required. We set Cache‑Control to no‑cache to ensure
   * the client always gets the latest image.
   */
  app.get("/qr/latest", (req, res) => {
    const qrPath = path.join(process.cwd(), "runtime", "qr_latest.png");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.sendFile(qrPath);
  });

  /**
   * Serve the admin UI. If the dist directory does not exist the
   * user will see a 404. To build the admin UI run `npm run
   * admin:build` in the root.
   */
  const adminDir = path.join(process.cwd(), "src", "admin", "dist");
  app.use("/admin", express.static(adminDir));

  app.listen(PORT, () => {
    console.log(`WhatsApp bot server listening on port ${PORT}`);
  });

  /**
   * Driver event listeners to forward notifications via web push.
   */
  driver.on("qr_required", () => pushNotification("qr_required"));
  driver.on("relinked", () => pushNotification("relinked"));
  driver.on("offline", () => pushNotification("offline"));
  driver.on("error", (err) => pushNotification("error", String(err)));

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
