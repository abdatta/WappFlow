import { getContacts, saveContacts, getSettings } from "./store.js";
import { Contact, ContactsFile } from "./types.js";
import { WhatsAppDriver } from "./driver.js";

/**
 * Manages a cache of WhatsApp contacts.
 * This class is responsible for loading contacts from storage, refreshing
 * them from the WhatsApp Web interface, and providing access to the cached
 * contact list. It helps to avoid repeatedly scraping the contact list from
 * the web, which is a slow operation.
 */
export class ContactsCache {
  // The in-memory list of contacts.
  private contacts: Contact[] = [];
  // Timestamp of the last successful refresh from the web.
  private lastRefreshed?: string;
  // Flags to prevent concurrent refresh operations or refreshing while a message is being sent.
  private refreshing = false;
  private sending = false;
  private driver: WhatsAppDriver;
  // The interval in seconds between automatic contact list refreshes.
  private refreshInterval = 3600;

  constructor(driver: WhatsAppDriver) {
    this.driver = driver;
  }

  /**
   * Initializes the contact cache.
   * It loads the contacts from the persistent store and schedules the first
   * refresh from the web.
   */
  async init(): Promise<void> {
    const [file, settings] = await Promise.all([getContacts(), getSettings()]);
    this.contacts = file.contacts.map((c) => ({
      name: c.name,
      phone: c.phone,
    }));
    this.lastRefreshed = file.lastRefreshed;
    this.refreshInterval = settings.contactsRefreshInterval ?? 3600;
    await this.refreshFromWeb();
  }

  /**
   * Sets a flag to indicate whether a message is currently being sent.
   * This is used to prevent the contact refresh from running while a send
   * operation is in progress, which could interfere with the browser automation.
   */
  setSending(flag: boolean): void {
    this.sending = flag;
  }

  /**
   * Refreshes the contact list from WhatsApp Web.
   * This method checks if a refresh is currently allowed (i.e., not already
   * refreshing, not sending a message, and the refresh interval has passed).
   * If so, it uses the driver to fetch the latest contact list and updates
   * the cache and the persistent store.
   */
  async refreshFromWeb(): Promise<void> {
    if (this.sending || this.refreshing) return;
    if (this.lastRefreshed) {
      const last = new Date(this.lastRefreshed).getTime();
      if (Date.now() - last < 1000 * this.refreshInterval) {
        return;
      }
    }
    this.refreshing = true;
    try {
      const fresh = await this.driver.fetchContacts();
      if (fresh.length) {
        this.contacts = fresh;
        this.lastRefreshed = new Date().toISOString();
        const file: ContactsFile = {
          contacts: this.contacts,
          lastRefreshed: this.lastRefreshed,
        };
        await saveContacts(file);
      }
    } catch (err) {
      console.error("Failed to refresh contacts", err);
    } finally {
      this.refreshing = false;
    }
  }

  /**
   * Returns the top N contacts from the cache.
   * The contacts are typically ordered by recent interaction, so this
   * provides a list of the most frequently contacted people.
   */
  getTop(n: number): Contact[] {
    return this.contacts.slice(0, n);
  }

  /**
   * Returns a copy of the entire contact list.
   */
  getAll(): Contact[] {
    return [...this.contacts];
  }

  /**
   * Adds a new contact or updates an existing one in the cache.
   * This is useful when a phone number is resolved for a contact that
   * was previously only known by name. The updated contact list is
   * then saved to the persistent store.
   */
  async upsert(contact: Contact): Promise<void> {
    const idx = this.contacts.findIndex((c) => c.name === contact.name);
    if (idx >= 0) {
      this.contacts[idx] = { ...this.contacts[idx], ...contact };
    } else {
      this.contacts.push(contact);
    }
    const file: ContactsFile = {
      contacts: this.contacts,
      lastRefreshed: this.lastRefreshed,
    };
    await saveContacts(file);
  }
}
