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
   * Initializes the Playwright browser instance and sets up a persistent context.
   * A persistent context is used to maintain the WhatsApp Web session, including
   * login state, by storing cookies and other session data in a user data directory.
   * This avoids the need to scan the QR code on every launch.
   *
   * In a production environment, this method would also include more robust
   * logic to handle various states of the WhatsApp Web interface, such as
   * detecting if a QR code is required, handling loading screens, and confirming
   * that the chat interface is fully loaded.
   */
  async init(): Promise<void> {
    const headless = this.settings.headless;
    // The user data directory is crucial for session persistence.
    const userDataDir = path.join(process.cwd(), "profiles", "whatsapp");
    const browser = (this.browser = await chromium.launchPersistentContext(
      userDataDir,
      {
        headless,
        // These arguments are recommended for running browsers in automated environments.
        args: ["--start-maximized"],
        // A standard viewport size is set to ensure consistent rendering.
        viewport: { width: 1280, height: 800 },
      },
    ));
    const [page] = browser.pages();
    this.page = page;
    // Navigate to WhatsApp Web home page.
    try {
      await page.goto("https://web.whatsapp.com");
      // In this simplified example, we assume the session is ready after a fixed delay.
      // A real implementation would wait for a specific element that indicates
      // the chat interface is loaded, and would handle QR code scanning.
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
   * Sends a text message to a given phone number.
   * This method constructs a `wa.me` style URL to open a chat directly with the
   * specified phone number. This is generally more reliable than searching for
   * a contact by name.
   *
   * The implementation includes delays to mimic human-like interaction and
   * waits for the message composer to be ready before sending the message.
   * After sending, it switches back to the "Me" chat to avoid leaving a
   * sensitive chat open.
   */
  async sendText(phone: string, text: string): Promise<void> {
    if (!this.page) throw new Error("Driver not initialised");
    await this.ensureReady();
    const encoded = encodeURIComponent(text);
    // This URL format opens a chat with the specified phone number.
    const url = `https://web.whatsapp.com/send?phone=${phone}&text=${encoded}`;
    await this.page.goto(url);
    // Wait for the message composer to appear before trying to send.
    const composerSelector = 'div[contenteditable="true"][data-tab]';
    await this.page.waitForSelector(composerSelector, { timeout: 15000 });
    // A small random delay can help avoid detection of automation.
    await delay(400 + Math.random() * 800);
    // Pressing 'Enter' sends the message.
    await this.page.keyboard.press("Enter");
    // A short delay to allow the message to be visually sent in the UI.
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

      // To make the selector for contact names robust against WhatsApp's
      // obfuscated and frequently changing class names, we first find a
      // known element (`span[title]`) and then get its dynamically
      // generated class names at runtime. This allows us to build a
      // selector that will work even if the class names change.
      const classNames = await this.page.evaluate(() => {
        const el = document.querySelector("span[title]");
        return el ? Array.from(el.classList) : [];
      });
      const nameSelector =
        "span[title]" + classNames.map((c) => `.${c}`).join("");

      // The contact list is in a scrollable container. To get all contacts,
      // we need to repeatedly scroll down. This logic finds the scrollable
      // parent element to automate the scrolling.
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

      // This loop scrolls through the contact list, scraping the names
      // of the contacts that appear. It continues until no new contacts
      // can be loaded by scrolling.
      while (true) {
        const batch: Contact[] = await this.page.$$eval(nameSelector, (els) =>
          els.map((el) => {
            const name = (el as HTMLElement).getAttribute("title") || "";
            return { name };
          }),
        );

        // Append new contacts to the list, avoiding duplicates.
        for (const c of batch) {
          if (!seen.has(c.name)) {
            seen.add(c.name);
            contacts.push(c);
          }
        }

        // Attempt to scroll down within the scrollable container.
        // The loop breaks if scrolling does not reveal new content.
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
   * Sends a text message to a contact.
   * If the contact has a phone number associated, it uses the `sendText` method
   * for a more direct and reliable send. If not, it falls back to searching
   * for the contact by their display name in the WhatsApp search bar,
   * clicking the search result, and then sending the message.
   *
   * @returns The phone number used to send the message, or `undefined` if
   *          sent via name search.
   */
  async sendTextToContact(
    contact: Contact,
    text: string,
  ): Promise<string | undefined> {
    // Prefer sending via phone number if available.
    if (contact.phone) {
      await this.sendText(contact.phone, text);
      return contact.phone;
    }
    // Fallback to searching by name.
    if (!this.page) throw new Error("Driver not initialised");
    await this.ensureReady();
    const searchSelector = "div[contenteditable='true'][data-tab='3']";
    const composerSelector = "div[contenteditable='true'][data-tab]";
    // Search for the contact by name.
    await this.page.click(searchSelector);
    await this.page.fill(searchSelector, contact.name);
    await this.page.waitForSelector(`span[title='${contact.name}']`, {
      timeout: 15000,
    });
    // Click the contact in the search results to open the chat.
    await this.page.click(`span[title='${contact.name}']`);
    await this.page.waitForSelector(composerSelector, { timeout: 15000 });

    // Type and send the message.
    await delay(400 + Math.random() * 800);
    await this.page.keyboard.type(text);
    await this.page.keyboard.press("Enter");
    await delay(1000);
    await this.switchToMeChat();

    return undefined;
  }

  /**
   * Switches the active chat to the "Me" contact (chatting with yourself).
   * This is a crucial cleanup step after sending a message. It ensures that
   * the bot does not leave a sensitive conversation open on the screen.
   * It also provides a consistent state for the next operation.
   */
  private async switchToMeChat(): Promise<void> {
    if (!this.page) return;
    try {
      const searchSelector = "div[contenteditable='true'][data-tab='3']";
      const contactName = this.settings.selfContactName;
      // The search input is cleared before typing the name to ensure
      // a clean search.
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
