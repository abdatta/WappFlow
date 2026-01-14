import webpush from "web-push";
import db from "../db/db.js";

class NotificationService {
  private publicKey: string | null = null;
  private privateKey: string | null = null;

  constructor() {
    this.initKeys();
  }

  private initKeys() {
    // Check if keys exist in settings
    const publicRow = db
      .prepare("SELECT value FROM settings WHERE key = 'vapid_public_key'")
      .get() as { value: string } | undefined;
    const privateRow = db
      .prepare("SELECT value FROM settings WHERE key = 'vapid_private_key'")
      .get() as { value: string } | undefined;

    if (publicRow && privateRow) {
      this.publicKey = publicRow.value;
      this.privateKey = privateRow.value;
    } else {
      // Generate new keys
      const keys = webpush.generateVAPIDKeys();
      this.publicKey = keys.publicKey;
      this.privateKey = keys.privateKey;

      db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run(
        "vapid_public_key",
        this.publicKey
      );
      db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run(
        "vapid_private_key",
        this.privateKey
      );
    }

    webpush.setVapidDetails(
      "mailto:example@yourdomain.org",
      this.publicKey!,
      this.privateKey!
    );
  }

  getPublicKey() {
    return this.publicKey;
  }

  addSubscription(subscription: any) {
    const keys = JSON.stringify(subscription.keys);
    try {
      db.prepare(
        "INSERT INTO subscriptions (endpoint, expirationTime, keys) VALUES (?, ?, ?)"
      ).run(subscription.endpoint, subscription.expirationTime, keys);
    } catch (e) {
      // Ignore unique constraint error (already subscribed)
    }
  }

  async sendNotification(payload: string | object) {
    const subs = db.prepare("SELECT * FROM subscriptions").all() as any[];

    const notificationPayload =
      typeof payload === "string" ? payload : JSON.stringify(payload);

    for (const sub of subs) {
      try {
        const pushSubscription = {
          endpoint: sub.endpoint,
          expirationTime: sub.expirationTime,
          keys: JSON.parse(sub.keys),
        };
        await webpush.sendNotification(pushSubscription, notificationPayload);
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          // Subscription expired/gone
          db.prepare("DELETE FROM subscriptions WHERE endpoint = ?").run(
            sub.endpoint
          );
        } else {
          console.error("Error sending notification:", err);
        }
      }
    }
  }
}

export const notificationService = new NotificationService();
