import { chromium, BrowserContext, Page } from "playwright";
import path from "path";
import fs from "fs";

const USER_DATA_DIR = path.resolve("data/whatsapp_session");
const STATUS_FILE = path.resolve("data/whatsapp_session_status.json");

interface SessionStatus {
  authenticated: boolean;
  lastChecked: string;
}

type QRCallback = (qrCode: string | null) => void;
type AuthCallback = () => void;
type ErrorCallback = (error: string) => void;

export class WhatsAppService {
  private browserContext: BrowserContext | null = null;
  private page: Page | null = null;
  private activeConnections = new Map<
    string,
    {
      onQR: QRCallback;
      onAuth: AuthCallback;
      onError: ErrorCallback;
    }
  >();
  private qrMonitorInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.ensureDirectories();
    // Check authentication status on boot, then close
    this.checkAuthOnce();
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
        `WhatsApp status: ${isAuthenticated ? "Authenticated" : "Disconnected"}`,
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
        viewport: { width: 1280, height: 960 },
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        args: [
          "--disable-blink-features=AutomationControlled", // Critical for stealth
          "--disable-extensions",
          "--disable-dev-shm-usage",
          "--no-sandbox",
          "--disable-setuid-sandbox",
        ],
      },
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
      // Wait a bit for page to load
      await this.page.waitForTimeout(3000);

      // Check if logged in by looking for search box
      const searchBox = await this.page.$('div[role="textbox"]');
      return searchBox !== null;
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
        return base64;
      } else {
        console.log("QR code element not found on page");
        // Take debug screenshot to see what's actually on the page
        const debugPath = path.resolve("data/whatsapp_debug.png");
        await this.page.screenshot({ path: debugPath, fullPage: true });
        console.log(`Debug screenshot saved to: ${debugPath}`);
      }
    } catch (err) {
      console.error("Failed to capture QR code:", err);
    }
    return null;
  }

  async startConnectionMonitoring(
    connectionId: string,
    onQR: QRCallback,
    onAuth: AuthCallback,
    onError: ErrorCallback,
  ) {
    console.log(`Starting connection monitoring for ${connectionId}`);
    this.activeConnections.set(connectionId, { onQR, onAuth, onError });

    try {
      await this.openBrowser();

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
          `QR code captured, broadcasting to ${this.activeConnections.size} connections`,
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
      await this.closeBrowser();
    }
  }

  async sendMessage(phoneNumber: string, message: string): Promise<boolean> {
    console.log(`Attempting to send message to ${phoneNumber}`);

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

      // Send message
      const cleanNumber = phoneNumber.replace(/\D/g, "");
      const url = `https://web.whatsapp.com/send?phone=${cleanNumber}&text=${encodeURIComponent(message)}`;

      await this.page!.goto(url);

      // Wait for send button
      const sendButtonSelector = 'span[data-icon="send"]';
      await this.page!.waitForSelector(sendButtonSelector, { timeout: 30000 });
      await this.page!.click(sendButtonSelector);

      // Wait for message to send
      await this.page!.waitForTimeout(3000);

      console.log("Message sent successfully");
      await this.closeBrowser();
      return true;
    } catch (err: any) {
      console.error("Failed to send message:", err);
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
