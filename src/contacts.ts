import { getContacts, saveContacts } from "./store.js";
import { Contact, ContactsFile } from "./types.js";
import { WhatsAppDriver } from "./driver.js";

export class ContactsCache {
  private contacts: Contact[] = [];
  private refreshing = false;
  private sending = false;
  private driver: WhatsAppDriver;

  constructor(driver: WhatsAppDriver) {
    this.driver = driver;
  }

  async init(): Promise<void> {
    const file = await getContacts();
    this.contacts = file.contacts.map((c) => ({
      name: c.name,
      phone: c.phone,
    }));
    await this.refreshFromWeb();
  }

  setSending(flag: boolean): void {
    this.sending = flag;
  }

  async refreshFromWeb(): Promise<void> {
    if (this.sending || this.refreshing) return;
    this.refreshing = true;
    try {
      const fresh = await this.driver.fetchContacts();
      if (fresh.length) {
        this.contacts = fresh;
        const file: ContactsFile = { contacts: this.contacts };
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
}
