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

    // Check if 'paused' status is supported
    try {
      db.exec("BEGIN TRANSACTION");
      const testStmt = db.prepare(
        "INSERT INTO schedules (type, contactName, message, status) VALUES ('once', 'test', 'test', 'paused')",
      );
      try {
        testStmt.run();
        db.exec("ROLLBACK");
      } catch (e: any) {
        db.exec("ROLLBACK");
        if (e.message && e.message.includes("CHECK constraint failed")) {
          console.log(
            "Detected missing 'paused' status support. Migrating schedules table while PRESERVING data...",
          );

          // 1. Rename existing table
          db.exec("ALTER TABLE schedules RENAME TO schedules_old");

          // 2. Create new table with updated schema (defined below in main block, but we need it now to copy)
          db.exec(`
            CREATE TABLE IF NOT EXISTS schedules (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              type TEXT NOT NULL CHECK(type IN ('instant', 'once', 'recurring')),
              contactName TEXT NOT NULL,
              message TEXT NOT NULL,
              scheduleTime TEXT,
              status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('pending', 'active', 'completed', 'failed', 'cancelled', 'paused')),
              lastRun TEXT,
              nextRun TEXT,
              createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
              intervalValue INTEGER,
              intervalUnit TEXT,
              toleranceMinutes INTEGER
            );
          `);

          // 3. Copy data from old table to new table
          db.exec(`
            INSERT INTO schedules (id, type, contactName, message, scheduleTime, status, lastRun, nextRun, createdAt, intervalValue, intervalUnit, toleranceMinutes)
            SELECT id, type, contactName, message, scheduleTime, status, lastRun, nextRun, createdAt, intervalValue, intervalUnit, toleranceMinutes
            FROM schedules_old
          `);

          // 4. Update foreign keys in message_logs (if necessary, though ON DELETE CASCADE might handle dropping, but we are renaming so ID references should stay valid)
          // Since we are not changing IDs, references in message_logs remain valid.

          // 5. Drop old table
          db.exec("DROP TABLE schedules_old");

          console.log("Migration completed. Data preserved.");
        }
      }
    } catch (e) {
      console.warn("Schema check failed", e);
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
