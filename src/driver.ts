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
  public settings: Settings;

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
    await this.switchToMeChat();
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
      // Open the "New chat" dialog which contains the full contact list
      const newChatBtn = 'button[title="New chat"]';
      await this.page.click(newChatBtn);
      await this.page.waitForSelector("div[role='grid'] span[title]", {
        timeout: 15000,
      });

      // Discover the runtime class names for contact title spans so we can
      // build a stable selector regardless of obfuscation.
      const classNames = await this.page.evaluate(() => {
        const el = document.querySelector("span[title]");
        return el ? Array.from(el.classList) : [];
      });
      const nameSelector =
        "span[title]" + classNames.map((c) => `.${c}`).join("");

      // Scroll through the contact list to ensure all contacts are loaded.
      const scrollSelector = await this.page.$eval(nameSelector, (element) => {
        let parent: HTMLElement | null = element.parentElement;
        while (parent) {
          const style = window.getComputedStyle(parent);
          const overflowY = style.overflowY;
          const overflowX = style.overflowX;

          const canScrollY =
            (overflowY === "auto" || overflowY === "scroll") &&
            parent.scrollHeight > parent.clientHeight;

          const canScrollX =
            (overflowX === "auto" || overflowX === "scroll") &&
            parent.scrollWidth > parent.clientWidth;

          if (canScrollY || canScrollX) {
            return "div." + (Array.from(parent.classList) || []).join(".");
          }

          parent = parent.parentElement;
        }
        return "body";
      });
      const seen = new Set<string>();
      const contacts: Contact[] = [];

      while (true) {
        const batch: Contact[] = await this.page.$$eval(nameSelector, (els) =>
          els.map((el) => {
            const name = (el as HTMLElement).getAttribute("title") || "";
            return { name };
          }),
        );

        // Append new contacts preserving order
        for (const c of batch) {
          if (!seen.has(c.name)) {
            seen.add(c.name);
            contacts.push(c);
          }
        }

        // Attempt to scroll down; break when we've reached the end
        const scrolled = await this.page
          .$eval(scrollSelector, (el) => {
            const { scrollTop, scrollHeight, clientHeight } = el as HTMLElement;
            if (scrollTop + clientHeight >= scrollHeight) return false;
            (el as HTMLElement).scrollBy(0, clientHeight);
            return Math.round(el.scrollTop + el.clientHeight) < el.scrollHeight;
          })
          .catch(() => false);
        if (!scrolled) break;
        await this.page.waitForTimeout(500);
      }

      // Close the dialog
      await this.page.click('div[aria-label="Back"]');

      return contacts;
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

    await delay(400 + Math.random() * 800);
    await this.page.keyboard.type(text);
    await this.page.keyboard.press("Enter");
    await delay(1000);
    await this.switchToMeChat();

    return undefined;
  }

  /**
   * Switch to the chat with myself. This is used to reset
   * the view after sending a message, to prevent accidental reads from other chats.
   */
  private async switchToMeChat(): Promise<void> {
    if (!this.page) return;
    try {
      const searchSelector = "div[contenteditable='true'][data-tab='3']";
      const contactName = this.settings.selfContactName;
      await this.page.click(searchSelector);
      await this.page.fill(searchSelector, ""); // Clear search
      await this.page.fill(searchSelector, contactName);
      await this.page.waitForSelector(`span[title='${contactName}']`, {
        timeout: 15000,
      });
      await this.page.click(`span[title='${contactName}']`);
    } catch (err) {
      console.error(
        `Failed to switch to '${this.settings.selfContactName}' chat:`,
        err,
      );
      this.emit(
        "error",
        new Error(
          `Failed to switch to '${this.settings.selfContactName}' chat`,
        ),
      );
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
