import fs from "fs";
import path from "path";
import { BrowserContext, chromium, Page } from "playwright";
import db from "../db/db.js";

// Utility function for human-like delays
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const USER_DATA_DIR = path.resolve("data/whatsapp_session");
const STATUS_FILE = path.resolve("data/whatsapp_session_status.json");
const TRACES_DIR = path.resolve("data/traces");
const SCREENSHOTS_DIR = path.resolve("data/screenshots");

// Ensure screenshots directory exists
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

// Ensure traces directory exists
if (!fs.existsSync(TRACES_DIR)) {
  fs.mkdirSync(TRACES_DIR, { recursive: true });
}

interface SessionStatus {
  authenticated: boolean;
  lastChecked: string;
}

type QRCallback = (qrCode: string | null) => void;
type AuthCallback = () => void;
type StreamCallback = (image: string) => void;

type ErrorCallback = (error: string) => void;

export class MessageUnknownError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MessageUnknownError";
  }
}

export class WhatsAppService {
  private browserContext: BrowserContext | null = null;
  private page: Page | null = null;
  private activeConnections = new Map<
    string,
    {
      onQR: QRCallback;
      onAuth: AuthCallback;
      onStream: StreamCallback;
      onError: ErrorCallback;
    }
  >();
  private qrMonitorInterval: NodeJS.Timeout | null = null;
  private streamInterval: NodeJS.Timeout | null = null;
  private isQRVisible: boolean = false;

  constructor() {
    this.ensureDirectories();
  }

  private ensureDirectories() {
    if (!fs.existsSync(USER_DATA_DIR)) {
      fs.mkdirSync(USER_DATA_DIR, { recursive: true });
    }
  }

  private saveStatus(authenticated: boolean) {
    const status: SessionStatus = {
      authenticated,
      lastChecked: new Date().toISOString(),
    };
    fs.writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2));
  }

  private loadStatus(): SessionStatus | null {
    try {
      if (fs.existsSync(STATUS_FILE)) {
        return JSON.parse(fs.readFileSync(STATUS_FILE, "utf-8"));
      }
    } catch (err) {
      console.error("Failed to load status:", err);
    }
    return null;
  }

  async checkAuthOnce(): Promise<boolean> {
    console.log("Checking WhatsApp authentication status...");
    try {
      await this.openBrowser();
      const isAuthenticated = await this.isLoggedIn();
      this.saveStatus(isAuthenticated);
      console.log(
        `WhatsApp status: ${isAuthenticated ? "Authenticated" : "Disconnected"}`
      );
      await this.closeBrowser();
      return isAuthenticated;
    } catch (err) {
      console.error("Failed to check auth status:", err);
      this.saveStatus(false);
      await this.closeBrowser();
      return false;
    }
  }

  getStatus(): { authenticated: boolean } {
    const status = this.loadStatus();
    return { authenticated: status?.authenticated ?? false };
  }

  private async openBrowser() {
    if (this.browserContext) return; // Already open

    console.log("Opening browser...");
    this.browserContext = await chromium.launchPersistentContext(
      USER_DATA_DIR,
      {
        headless: true,
        viewport: null,
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        args: [
          "--window-size=1280,960",
          "--disable-blink-features=AutomationControlled", // Critical for stealth
          "--disable-extensions",
          "--disable-dev-shm-usage",
          "--no-sandbox",
          "--disable-setuid-sandbox",
        ],
      }
    );

    this.page =
      this.browserContext.pages()[0] || (await this.browserContext.newPage());

    // Hide webdriver property and other automation indicators
    await this.page.addInitScript(() => {
      // Override navigator.webdriver
      Object.defineProperty(navigator, "webdriver", {
        get: () => undefined,
      });

      // Override plugins to make it look like a real browser
      Object.defineProperty(navigator, "plugins", {
        get: () => [1, 2, 3, 4, 5],
      });

      // Override languages
      Object.defineProperty(navigator, "languages", {
        get: () => ["en-US", "en"],
      });

      // Chrome runtime
      (window as any).chrome = {
        runtime: {},
      };
    });

    await this.page.goto("https://web.whatsapp.com", {
      waitUntil: "networkidle",
    });
  }

  private async closeBrowser() {
    if (this.qrMonitorInterval) {
      clearInterval(this.qrMonitorInterval);
      this.qrMonitorInterval = null;
    }

    if (this.streamInterval) {
      clearInterval(this.streamInterval);
      this.streamInterval = null;
    }

    if (this.browserContext) {
      console.log("Closing browser...");
      await this.browserContext.close();
      this.browserContext = null;
      this.page = null;
    }
  }

  private async isLoggedIn(): Promise<boolean> {
    if (!this.page) return false;

    try {
      // Wait up to 10 seconds for the search box to appear
      await this.page.waitForSelector('div[role="textbox"]', {
        timeout: 10000,
      });
      return true;
    } catch (err) {
      return false;
    }
  }

  private async getQRCode(): Promise<string | null> {
    if (!this.page) {
      return null;
    }

    try {
      console.log("Searching for QR code...");
      const qrContainer = await this.page.$("div:has(> canvas)");
      if (qrContainer) {
        const buffer = await qrContainer.screenshot();
        const base64 = `data:image/png;base64,${buffer.toString("base64")}`;
        this.isQRVisible = true;
        return base64;
      } else {
        console.log("QR code element not found on page");
        this.isQRVisible = false;
        // Take debug screenshot to see what's actually on the page
        const debugPath = path.resolve("data/whatsapp_debug.png");
        await this.page.screenshot({ path: debugPath, fullPage: true });
        console.log(`Debug screenshot saved to: ${debugPath}`);
      }
    } catch (err) {
      console.error("Failed to capture QR code:", err);
      this.isQRVisible = false;
    }
    return null;
  }

  async startConnectionMonitoring(
    connectionId: string,
    onQR: QRCallback,
    onAuth: AuthCallback,
    onError: ErrorCallback,
    onStream: StreamCallback
  ) {
    console.log(`Starting connection monitoring for ${connectionId}`);
    this.activeConnections.set(connectionId, {
      onQR,
      onAuth,
      onError,
      onStream,
    });

    try {
      await this.openBrowser();

      // Start streaming immediately
      this.startStreaming();

      // Initial check
      const isAuth = await this.isLoggedIn();
      if (isAuth) {
        console.log("Already authenticated!");
        this.saveStatus(true);
        // Notify all connections
        for (const [id, callbacks] of this.activeConnections) {
          callbacks.onAuth();
        }
        await this.closeAllConnections();
        return;
      }

      // Try to get QR code immediately
      const initialQR = await this.getQRCode();
      if (initialQR) {
        console.log("Initial QR code captured");
        onQR(initialQR);
      }

      // Start monitoring interval only if not already running
      if (!this.qrMonitorInterval) {
        console.log("Starting QR monitoring interval");
        this.qrMonitorInterval = setInterval(() => {
          this.monitorAllConnections().catch((err) => {
            console.error("Error in monitoring interval:", err);
          });
        }, 2000);
      }
    } catch (err: any) {
      console.error("Connection monitoring error:", err);
      onError(err.message);
      await this.stopConnectionMonitoring(connectionId);
    }
  }

  private startStreaming() {
    if (this.streamInterval) return;

    console.log("Starting browser streaming...");
    this.streamInterval = setInterval(async () => {
      // Pause streaming if QR code is visible (optimization)
      if (this.isQRVisible) return;

      if (!this.page || this.page.isClosed()) return;

      try {
        // Capture screenshot of the full page (scaled down for performance if needed, but standard is fine)
        const buffer = await this.page.screenshot({
          type: "jpeg",
          quality: 50, // Compress to reduce bandwidth
          scale: "css",
        });
        const base64 = `data:image/jpeg;base64,${buffer.toString("base64")}`;

        // Broadcast to all connections that requested streaming
        for (const [id, callbacks] of this.activeConnections) {
          callbacks.onStream(base64);
        }
      } catch (err) {
        // Ignore errors during streaming (page might be closing etc)
      }
    }, 1000); // 1 second interval
  }

  private async monitorAllConnections() {
    try {
      if (!this.page || this.page.isClosed()) {
        console.log("Monitor: Page is closed or null");
        return;
      }

      // Check if authenticated
      const isAuth = await this.isLoggedIn();
      if (isAuth) {
        console.log("WhatsApp authenticated!");
        this.saveStatus(true);
        // Notify all connections
        for (const [id, callbacks] of this.activeConnections) {
          callbacks.onAuth();
        }
        await this.closeAllConnections();
        return;
      }

      // Get QR code and broadcast to all connections
      const qr = await this.getQRCode();
      if (qr) {
        console.log(
          `QR code captured, broadcasting to ${this.activeConnections.size} connections`
        );
        for (const [id, callbacks] of this.activeConnections) {
          callbacks.onQR(qr);
        }
      }
    } catch (err: any) {
      console.error("Monitor error:", err);
    }
  }

  private async closeAllConnections() {
    const connectionIds = Array.from(this.activeConnections.keys());
    for (const id of connectionIds) {
      await this.stopConnectionMonitoring(id);
    }
  }

  async stopConnectionMonitoring(connectionId: string) {
    console.log(`Stopping connection monitoring for ${connectionId}`);
    this.activeConnections.delete(connectionId);

    // Stop monitoring and close browser if no more active connections
    if (this.activeConnections.size === 0) {
      if (this.qrMonitorInterval) {
        console.log("Stopping QR monitoring interval");
        clearInterval(this.qrMonitorInterval);
        this.qrMonitorInterval = null;
      }
      if (this.streamInterval) {
        clearInterval(this.streamInterval);
        this.streamInterval = null;
      }
      await this.closeBrowser();
    }
  }

  private async ensureReady(): Promise<void> {
    if (!this.page) throw new Error("Page not initialized");
    // Wait for WhatsApp Web to be fully loaded
    await this.page.waitForSelector('div[role="textbox"]', { timeout: 30000 });
    await delay(1000);
  }

  // Method to open a specific chat by name
  async openChat(contactName: string): Promise<void> {
    if (!this.page) throw new Error("Page not initialized");

    console.log(`Opening chat: ${contactName}`);
    const searchSelector = "div[contenteditable='true'][data-tab='3']";
    const composerSelector = "div[contenteditable='true'][data-tab]";

    try {
      // Search for the contact by name
      // Sometimes just clicking search is enough, but to be safe we clear and retype
      await this.page.click(searchSelector);

      // Clear search box first ensuring we don't append to previous search
      await this.page.keyboard.press("Control+A");
      await this.page.keyboard.press("Backspace");

      await this.page.fill(searchSelector, contactName);

      // Wait for the specific contact in list
      await this.page.waitForSelector(`span[title='${contactName}']`, {
        timeout: 15000,
      });

      // Click the contact in the search results to open the chat
      await this.page.click(`span[title='${contactName}']`);

      // Wait for chat composer to be ready
      await this.page.waitForSelector(composerSelector, { timeout: 15000 });
      console.log(`Chat opened: ${contactName}`);
    } catch (err) {
      console.error(`Failed to open chat '${contactName}':`, err);
      throw err;
    }
  }

  private async returnToDefaultChat(): Promise<void> {
    const defaultChat = process.env.WHATSAPP_DEFAULT_CHAT;
    if (defaultChat) {
      try {
        await this.openChat(defaultChat);
      } catch (e) {
        console.warn(
          `Failed to return to default chat '${defaultChat}'. Details:`,
          e
        );
      }
    }
  }

  async sendMessage(
    contactName: string,
    message: string,
    logId?: number | bigint
  ): Promise<void> {
    console.log(`Attempting to send message to contact: ${contactName}`);

    // Check if tracing is enabled
    let tracingEnabled = false;
    try {
      const setting = db
        .prepare("SELECT value FROM settings WHERE key = 'enable_tracing'")
        .get() as { value: string } | undefined;
      tracingEnabled = setting?.value === "true";
    } catch (err) {
      console.error("Failed to check tracing setting:", err);
    }

    try {
      await this.openBrowser();

      // Check if still logged in
      const isAuth = await this.isLoggedIn();
      if (!isAuth) {
        console.error("Not authenticated - QR code detected");
        this.saveStatus(false);
        await this.closeBrowser();
        throw new Error("WhatsApp session expired - please reconnect");
      }

      if (!this.page) throw new Error("Driver not initialized");
      await this.ensureReady();

      // Open the target chat
      await this.openChat(contactName);

      // Start tracing if enabled and context is available
      if (tracingEnabled && this.browserContext) {
        console.log(`Starting trace for logId: ${logId}`);
        await this.browserContext.tracing.start({
          screenshots: true,
          snapshots: true,
          sources: true,
        });
      }

      // Type and send the message
      await delay(400 + Math.random() * 800);
      // Clear any existing text first
      await this.page.keyboard.press("Control+A");
      await this.page.keyboard.press("Backspace");
      await delay(200);

      await this.page.keyboard.type(message);
      await this.page.keyboard.press("Enter");
      await delay(2000);

      // Wait for message to be sent (status != 'Pending')
      // Using locator API as requested: verify last message's status icon
      console.log("Waiting for message status to update from Pending...");
      await this.page
        .waitForFunction(
          () => {
            const allMessages = document.querySelectorAll(".message-out");
            const lastMessage = allMessages[allMessages.length - 1];
            if (!lastMessage) {
              console.log("[WaitForFunction] No .message-out elements found");
              return false;
            }

            const svgs = lastMessage.querySelectorAll("svg");
            const lastSvg = svgs[svgs.length - 1];
            if (!lastSvg) {
              console.log(
                "[WaitForFunction] SVG element not found in last message"
              );
            }
            // The status icon container is the parent of the SVG
            const statusContainer = lastSvg?.parentElement;

            if (!statusContainer) {
              console.log(
                "[WaitForFunction] Status container (SVG parent) not found in last message"
              );
              return false;
            }

            const label = statusContainer.getAttribute("aria-label");
            console.log(`[WaitForFunction] Current status label: '${label}'`);
            return label && label.trim() !== "Pending";
          },
          null, // No arguments passed
          { timeout: 20000 }
        )
        .catch(async (err) => {
          console.error(
            `Message status verification timed out: ${err.message}. Marking as unknown.`
          );

          // Take screenshot if logId is present
          if (logId) {
            const screenshotPath = path.join(
              SCREENSHOTS_DIR,
              `unknown_run_${logId}.png`
            );
            try {
              if (this.page) {
                await this.page.screenshot({ path: screenshotPath });
                console.log(`Saved screenshot to ${screenshotPath}`);
              }
            } catch (shotErr) {
              console.error("Failed to take failure screenshot", shotErr);
            }
          }

          throw new MessageUnknownError(
            "Message sent but status verification timed out."
          );
        });

      // Return to default chat instead of chat list
      // This is crucial: if we keep the recipient's chat open, their reply might be auto-read if they reply quickly.
      // Switching to a "safe" default chat (like 'Me' or 'Saved Messages') prevents this unintended read receipt.
      await this.returnToDefaultChat();

      console.log("Message sent successfully via contact search");

      if (tracingEnabled && this.browserContext && logId) {
        const tracePath = path.join(TRACES_DIR, `trace_${logId}.zip`);
        await this.browserContext.tracing.stop({ path: tracePath });
        console.log(`Trace saved to: ${tracePath}`);
      }

      await this.closeBrowser();
    } catch (err: any) {
      console.error("Failed to send message to contact:", err);

      if (tracingEnabled && this.browserContext && logId) {
        try {
          const tracePath = path.join(TRACES_DIR, `trace_${logId}.zip`);
          await this.browserContext.tracing.stop({ path: tracePath });
          console.log(`Trace saved to: ${tracePath} (after failure)`);
        } catch (traceErr) {
          console.error("Failed to save trace after error:", traceErr);
        }
      }

      await this.closeBrowser();
      throw err;
    }
  }

  async destroy() {
    this.activeConnections.clear();
    await this.closeBrowser();
  }
}

export const whatsappService = new WhatsAppService();
