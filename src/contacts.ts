import { getContacts, saveContacts } from "./store.js";
import { Contact, ContactsFile } from "./types.js";

export class ContactsCache {
  private contacts: Contact[] = [];
  private refreshing = false;
  private sending = false;

  async init(): Promise<void> {
    const file = await getContacts();
    this.contacts = file.contacts;
  }

  setSending(flag: boolean): void {
    this.sending = flag;
  }

  async refresh(): Promise<void> {
    if (this.sending || this.refreshing) return;
    this.refreshing = true;
    try {
      const file = await getContacts();
      this.contacts = file.contacts;
    } finally {
      this.refreshing = false;
    }
  }

  async recordUsage(phone: string, name = ""): Promise<void> {
    const existing = this.contacts.find((c) => c.phone === phone);
    if (existing) {
      existing.count += 1;
      if (name && !existing.name) existing.name = name;
    } else {
      this.contacts.push({ name, phone, count: 1 });
    }
    const file: ContactsFile = { contacts: this.contacts };
    await saveContacts(file);
  }

  getTop(n: number): Contact[] {
    return [...this.contacts].sort((a, b) => b.count - a.count).slice(0, n);
  }

  getAll(): Contact[] {
    return [...this.contacts];
  }
}
