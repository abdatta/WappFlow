import Database from "better-sqlite3";

export function runMigrations(db: Database.Database) {
  // DROP tables to enforce schema change (Data Loss is expected/requested)
  try {
    const tableInfo = db.prepare("PRAGMA table_info(schedules)").all() as any[];
    const activeTableInfo = db
      .prepare("PRAGMA table_info(message_logs)")
      .all() as any[];
    const hasCron = tableInfo.some((col) => col.name === "cronExpression");
    const hasContactInLogs = activeTableInfo.some(
      (col) => col.name === "contactName",
    );

    if (hasCron || !hasContactInLogs) {
      console.log("Detected schema change. Dropping tables to migrate...");
      db.exec("DROP TABLE IF EXISTS message_logs");
      // Only drop schedules if it's the cron migration, but user said "delete all" is fine so we can be aggressive if needed.
      // But to be nice, let's only drop schedules if it's the old cron one, or if we want to clean slate.
      // User said "feel free to delete all". Let's drop schedules too to ensure consistency if we really want,
      // but strictly speaking we only need to drop message_logs for this feature if schedules is fine.
      // However, the previous code dropped both on 'hasCron'.
      // If !hasContactInLogs, it means we have the 'old' message_logs from previous step.
      // Let's drop message_logs.
    }
  } catch (err) {
    console.warn("Error checking schema:", err);
  }

  // Schedules Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK(type IN ('instant', 'once', 'recurring')),
      contactName TEXT NOT NULL,
      message TEXT NOT NULL,
      scheduleTime TEXT, -- ISO 8601 for 'once'
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('pending', 'active', 'completed', 'failed', 'cancelled')),
      lastRun TEXT,
      nextRun TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      intervalValue INTEGER,
      intervalUnit TEXT,
      toleranceMinutes INTEGER
    );
  `);

  // Message Logs Table (History)
  db.exec(`
    CREATE TABLE IF NOT EXISTS message_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scheduleId INTEGER, -- Nullable for instant messages
      type TEXT NOT NULL CHECK(type IN ('instant', 'once', 'recurring')),
      contactName TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('sending', 'sent', 'failed')),
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
      error TEXT,
      FOREIGN KEY (scheduleId) REFERENCES schedules(id) ON DELETE CASCADE
    );
  `);

  // Settings / KV Store
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Push Subscriptions
  db.exec(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      endpoint TEXT PRIMARY KEY,
      expirationTime INTEGER,
      keys TEXT NOT NULL
    );
  `);

  console.log("Migrations applied successfully.");
}
