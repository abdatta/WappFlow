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
   * order WhatsApp presents them (most recent first). The DOM
   * structure of WhatsApp Web is highly dynamic, so this routine
   * first discovers the runtime class names used for contact
   * elements and then queries using that selector.
   */
  async fetchContacts(): Promise<Contact[]> {
    if (!this.page) throw new Error("Driver not initialised");
    await this.ensureReady();
    try {
      const searchSelector = "div[contenteditable='true'][data-tab='3']";
      // Step 1/2: type "You" to ensure a predictable element then
      // read its class list so we can build a stable selector.
      await this.page.click(searchSelector);
      await this.page.fill(searchSelector, "You");
      const classNames = await this.page.evaluate(() => {
        const el = document.querySelector("span[title]");
        return el ? Array.from(el.classList) : [];
      });
      const nameSelector =
        "span[title]" + classNames.map((c) => `.${c}`).join("");
      // Step 4: clear the search box so the default top contacts
      // list is visible again.
      await this.page.fill(searchSelector, "");
      // Step 5: query all contact name elements using the computed
      // selector and extract names and phone numbers if present.
      const contacts = await this.page.evaluate((sel) => {
        const items: { name: string; phone?: string }[] = [];
        document.querySelectorAll(sel).forEach((el) => {
          const name = (el as HTMLElement).getAttribute("title") || "";
          let phone: string | undefined;
          const row = el.closest("div[role='row']");
          if (row) {
            const testId = row.getAttribute("data-testid") || "";
            const m = testId.match(/list-item-(\d+)(@c\.us)?/);
            if (m) phone = m[1];
          }
          if (!phone && /^\+?\d+$/.test(name)) phone = name;
          items.push({ name, phone });
        });
        return items;
      }, nameSelector);
      return contacts as Contact[];
    } catch (err) {
      this.emit("error", err);
      return [];
    }
  }

  /**
   * Send a text message to a contact by phone number if available,
   * otherwise fall back to searching by the contact's display name.
   */
  async sendTextToContact(
    contact: Contact,
    text: string,
  ): Promise<string | undefined> {
    if (contact.phone) {
      await this.sendText(contact.phone, text);
      return contact.phone;
    }
    if (!this.page) throw new Error("Driver not initialised");
    await this.ensureReady();
    const searchSelector = "div[contenteditable='true'][data-tab='3']";
    const composerSelector = "div[contenteditable='true'][data-tab]";
    await this.page.click(searchSelector);
    await this.page.fill(searchSelector, contact.name);
    await this.page.waitForSelector(`span[title='${contact.name}']`, {
      timeout: 15000,
    });
    await this.page.click(`span[title='${contact.name}']`);
    await this.page.waitForSelector(composerSelector, { timeout: 15000 });
    const phone = await this.page.evaluate(() => {
      const header = document.querySelector("header [data-testid]");
      if (!header) return undefined;
      const testId = header.getAttribute("data-testid") || "";
      const m = testId.match(/(\d+)(@c\.us)?/);
      if (m) return m[1];
      const title = header.querySelector("span[title]") as HTMLElement | null;
      const t = title?.getAttribute("title") || "";
      if (/^\+?\d+$/.test(t)) return t;
      return undefined;
    });
    await delay(400 + Math.random() * 800);
    await this.page.keyboard.type(text);
    await this.page.keyboard.press("Enter");
    await delay(1000);
    return phone || undefined;
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
