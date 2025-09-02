import { getContacts, saveContacts, getSettings } from "./store.js";
import { Contact, ContactsFile } from "./types.js";
import { WhatsAppDriver } from "./driver.js";

export class ContactsCache {
  private contacts: Contact[] = [];
  private lastRefreshed?: string;
  private refreshing = false;
  private sending = false;
  private driver: WhatsAppDriver;
  private refreshInterval = 3600;

  constructor(driver: WhatsAppDriver) {
    this.driver = driver;
  }

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

  setSending(flag: boolean): void {
    this.sending = flag;
  }

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

  getTop(n: number): Contact[] {
    return this.contacts.slice(0, n);
  }

  getAll(): Contact[] {
    return [...this.contacts];
  }

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
