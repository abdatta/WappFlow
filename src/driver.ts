/*
 * Playwright controller for WhatsApp Web. This module encapsulates
 * the automation logic required to send messages via the WhatsApp
 * Web interface. In a real deployment the logic would include
 * robust selectors, QR code detection and phone offline
 * detection. For this example implementation we keep the logic
 * intentionally simple to avoid brittle tests against the live
 * WhatsApp site. The API is designed so that production logic can
 * replace these stubs without affecting the rest of the codebase.
 */

import { chromium, Browser, BrowserContext, Page } from "playwright";
import { EventEmitter } from "events";
import path from "path";
import { Settings, SessionState, Contact } from "./types.js";
import { now, delay } from "./utils.js";

export interface DriverEvents {
  qr_required: () => void;
  relinked: () => void;
  offline: () => void;
  error: (err: any) => void;
}

/**
 * WhatsApp Web driver. Manages a persistent Playwright context and
 * exposes high level send operations. Emits events when a QR
 * relink is required or when the phone goes offline.
 */
export class WhatsAppDriver extends EventEmitter {
  private browser: BrowserContext | null = null;
  private page: Page | null = null;
  private session: SessionState = { qr: null, ready: false, lastReadyAt: null };
  private settings: Settings;

  constructor(settings: Settings) {
    super();
    this.settings = settings;
  }

  /**
   * Launch the browser and prepare the WhatsApp Web session. In
   * production this would wait for the chat list to appear,
   * capture QR codes, click through banners and so on. Here we
   * simply open WhatsApp Web and assume readiness after a delay.
   */
  async init(): Promise<void> {
    const headless = this.settings.headless;
    const userDataDir = path.join(process.cwd(), "profiles", "whatsapp");
    const browser = (this.browser = await chromium.launchPersistentContext(
      userDataDir,
      {
        headless,
        args: ["--start-maximized"],
        viewport: { width: 1280, height: 800 },
      },
    ));
    const [page] = browser.pages();
    this.page = page;
    // Navigate to WhatsApp Web home page
    try {
      await page.goto("https://web.whatsapp.com");
      // In this stub we don't implement QR detection; we mark ready after 5 seconds
      await delay(5000);
      this.session.ready = true;
      this.session.lastReadyAt = now(this.settings.timezone).toISOString();
      this.emit("relinked");
    } catch (err) {
      this.emit("error", err);
    }
  }

  /**
   * Return current readiness state.
   */
  isReady(): boolean {
    return this.session.ready;
  }

  /**
   * Ensure the session is ready to send messages. If not ready a
   * QR relink is required and an error will be thrown.
   */
  async ensureReady(): Promise<void> {
    if (!this.isReady()) {
      // In a real implementation we would capture the QR code here
      this.emit("qr_required");
      throw new Error("QR_REQUIRED");
    }
  }

  /**
   * Send a text message to the specified E.164 phone number. This
   * implementation navigates to a send URL and simulates a key
   * press. It deliberately uses generic selectors and waits to
   * reduce flakiness. In a real production environment more robust
   * selectors and error handling would be required.
   */
  async sendText(phone: string, text: string): Promise<void> {
    if (!this.page) throw new Error("Driver not initialised");
    await this.ensureReady();
    const encoded = encodeURIComponent(text);
    const url = `https://web.whatsapp.com/send?phone=${phone}&text=${encoded}`;
    await this.page.goto(url);
    // Wait for composer
    const composerSelector = 'div[contenteditable="true"][data-tab]';
    await this.page.waitForSelector(composerSelector, { timeout: 15000 });
    // Small random delay
    await delay(400 + Math.random() * 800);
    // Press enter to send
    await this.page.keyboard.press("Enter");
    // Confirm bubble by waiting a bit
    await delay(1000);
  }

  /**
   * Scrape the sidebar contact list and return contacts in the
   * order WhatsApp presents them (most recent first). This stub
   * implementation returns an empty array but demonstrates where
   * scraping logic would live.
   */
  async fetchContacts(): Promise<Contact[]> {
    if (!this.page) throw new Error("Driver not initialised");
    await this.ensureReady();
    try {
      const contacts = await this.page.evaluate(() => {
        const items: { name: string; phone: string }[] = [];
        const rows = document.querySelectorAll("#pane-side div[role='row']");
        rows.forEach((row) => {
          const titleEl = row.querySelector("span[title]");
          const name = titleEl ? titleEl.getAttribute("title") || "" : "";
          // Phone numbers aren't exposed in the UI; in a real
          // implementation you would resolve them via the Web API.
          items.push({ name, phone: name });
        });
        return items;
      });
      return contacts;
    } catch (err) {
      this.emit("error", err);
      return [];
    }
  }

  /**
   * Get a snapshot of the current session state. Used for health
   * endpoint.
   */
  getSessionState(): SessionState {
    return { ...this.session };
  }

  /**
   * Close the browser when shutting down.
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }
}
