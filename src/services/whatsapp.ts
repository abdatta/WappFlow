import { chromium, BrowserContext, Page } from "playwright";
import path from "path";
import fs from "fs";

const USER_DATA_DIR = path.resolve("data/whatsapp_session");

export class WhatsAppService {
  private browserContext: BrowserContext | null = null;
  private page: Page | null = null;
  private qrCode: string | null = null; // Base64 image
  private authenticated: boolean = false;
  private status: "initializing" | "ready" | "disconnected" = "initializing";

  constructor() {
    this.initialize();
  }

  async initialize() {
    try {
      console.log("Initializing WhatsApp Service...");
      if (!fs.existsSync(USER_DATA_DIR)) {
        fs.mkdirSync(USER_DATA_DIR, { recursive: true });
      }

      this.browserContext = await chromium.launchPersistentContext(
        USER_DATA_DIR,
        {
          headless: false, // Must be false to work reliably with WA Web initially
          viewport: { width: 1280, height: 960 },
          args: [
            "--disable-extensions",
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-gl-drawing-for-tests",
            "--disable-dev-shm-usage",
          ],
        },
      );

      this.page =
        this.browserContext.pages()[0] || (await this.browserContext.newPage());

      await this.page.goto("https://web.whatsapp.com");

      this.monitorStatus();
    } catch (err) {
      console.error("Failed to initialize WhatsApp Service:", err);
      this.status = "disconnected";
    }
  }

  private async monitorStatus() {
    if (!this.page) return;

    // Check for QR Code or Chat List
    try {
      // Periodic check
      setInterval(async () => {
        if (!this.page || this.page.isClosed()) return;

        // Check if logged in (look for chat list specific element, e.g., #pane-side)
        // Note: Class names change, finding by reliable selectors is key.
        // Using aria-label or specific localized text is risky.
        // 2024: often identifiable by id="pane-side" or data-testid="chat-list"
        const isLoggedIn = await this.page.$('div[role="textbox"]'); // Search box is a good indicator

        if (isLoggedIn) {
          if (!this.authenticated) {
            console.log("WhatsApp Authenticated!");
            this.authenticated = true;
            this.qrCode = null;
            this.status = "ready";
          }
        } else {
          // Check for QR Code canvas
          const qrCanvas = await this.page.$("canvas");
          if (qrCanvas) {
            this.authenticated = false;
            this.status = "initializing";
            // Capture QR
            // We can take a screenshot of the canvas or specific container
            // data-testid="qrcode"
            const qrContainer = await this.page.$('[data-testid="qrcode"]');
            if (qrContainer) {
              const buffer = await qrContainer.screenshot();
              this.qrCode = `data:image/png;base64,${buffer.toString("base64")}`;
            }
          }
        }
      }, 2000);
    } catch (err) {
      console.error("Error monitoring status:", err);
    }
  }

  getStatus() {
    return {
      status: this.status,
      authenticated: this.authenticated,
      qrCode: this.qrCode,
    };
  }

  async sendMessage(phoneNumber: string, message: string): Promise<boolean> {
    if (!this.authenticated || !this.page) {
      throw new Error("WhatsApp not connected");
    }

    try {
      // Format number: remove + and spaces
      const cleanNumber = phoneNumber.replace(/\D/g, "");

      // Navigate to chat
      // https://web.whatsapp.com/send?phone=...&text=...
      const url = `https://web.whatsapp.com/send?phone=${cleanNumber}&text=${encodeURIComponent(message)}`;

      // Use existing page or new one? Existing page is safer for session
      await this.page.goto(url);

      // Wait for send button
      // data-testid="send" or aria-label="Send"
      const sendButtonSelector = 'span[data-icon="send"]';
      await this.page.waitForSelector(sendButtonSelector, { timeout: 30000 });
      await this.page.click(sendButtonSelector);

      // Wait a bit for message to actually send (tick icon)
      // or just wait fixed time
      await this.page.waitForTimeout(3000);

      return true;
    } catch (err) {
      console.error("Failed to send message:", err);
      // Try to recover page
      await this.page.goto("https://web.whatsapp.com");
      throw err;
    }
  }

  async destroy() {
    if (this.browserContext) {
      await this.browserContext.close();
    }
  }
}

export const whatsappService = new WhatsAppService();
