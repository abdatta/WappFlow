import Database from "better-sqlite3";

export function runMigrations(db: Database.Database) {
  // Schedules Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK(type IN ('instant', 'once', 'recurring')),
      contactName TEXT NOT NULL,
      message TEXT NOT NULL,
      scheduleTime TEXT, -- ISO 8601 for 'once'
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('pending', 'active', 'completed', 'failed', 'cancelled', 'paused')),
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
      status TEXT NOT NULL CHECK(status IN ('sending', 'sent', 'failed', 'unknown')),
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
      error TEXT,
      FOREIGN KEY (scheduleId) REFERENCES schedules(id) ON DELETE CASCADE
    );
  `);

  // Migration: Add 'unknown' to status check constraint if not present
  try {
    const tableInfo = db
      .prepare(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name='message_logs'"
      )
      .get() as { sql: string };

    if (tableInfo && !tableInfo.sql.includes("'unknown'")) {
      console.log("Migrating message_logs to include 'unknown' status...");

      db.transaction(() => {
        // 1. Rename old table
        db.exec("ALTER TABLE message_logs RENAME TO message_logs_old");

        // 2. Create new table (same as above definition)
        db.exec(`
          CREATE TABLE message_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            scheduleId INTEGER,
            type TEXT NOT NULL CHECK(type IN ('instant', 'once', 'recurring')),
            contactName TEXT NOT NULL,
            message TEXT NOT NULL,
            status TEXT NOT NULL CHECK(status IN ('sending', 'sent', 'failed', 'unknown')),
            timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
            error TEXT,
            FOREIGN KEY (scheduleId) REFERENCES schedules(id) ON DELETE CASCADE
          )
        `);

        // 3. Copy data
        db.exec(`
          INSERT INTO message_logs (id, scheduleId, type, contactName, message, status, timestamp, error)
          SELECT id, scheduleId, type, contactName, message, status, timestamp, error FROM message_logs_old
        `);

        // 4. Drop old table
        db.exec("DROP TABLE message_logs_old");
      })();

      console.log("Migration 'message_logs_unknown_status' completed.");
    }
  } catch (err) {
    console.error("Migration failed:", err);
  }

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

  // Feedbacks Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS feedbacks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      isAddressed INTEGER DEFAULT 0, -- 0 for false, 1 for true
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  console.log("Migrations applied successfully.");
}
