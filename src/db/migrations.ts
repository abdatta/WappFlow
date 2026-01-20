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
      (col) => col.name === "contactName"
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

    // CHECK FOR BROKEN FOREIGN KEYS (Fix for 'schedules_old' issue)
    try {
      const fks = db
        .prepare("PRAGMA foreign_key_list(message_logs)")
        .all() as any[];
      const brokenFk = fks.find((fk) => fk.table === "schedules_old");
      if (brokenFk) {
        console.log(
          "Detected broken foreign key pointing to 'schedules_old'. Repairing message_logs..."
        );
        db.exec("BEGIN TRANSACTION");
        try {
          // 1. Rename broken table
          db.exec("ALTER TABLE message_logs RENAME TO message_logs_broken");

          // 2. Create new table (definition below will be used, but we need strictly valid schema now)
          // We can use the same definition as the main creation block
          db.exec(`
            CREATE TABLE IF NOT EXISTS message_logs (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              scheduleId INTEGER,
              type TEXT NOT NULL CHECK(type IN ('instant', 'once', 'recurring')),
              contactName TEXT NOT NULL,
              message TEXT NOT NULL,
              status TEXT NOT NULL CHECK(status IN ('sending', 'sent', 'failed')),
              timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
              error TEXT,
              FOREIGN KEY (scheduleId) REFERENCES schedules(id) ON DELETE CASCADE
            );
          `);

          // 3. Copy data
          db.exec(`
            INSERT INTO message_logs (id, scheduleId, type, contactName, message, status, timestamp, error)
            SELECT id, scheduleId, type, contactName, message, status, timestamp, error
            FROM message_logs_broken
          `);

          // 4. Drop broken table
          db.exec("DROP TABLE message_logs_broken");

          db.exec("COMMIT");
          console.log("Repaired message_logs table.");
        } catch (err) {
          db.exec("ROLLBACK");
          console.error("Failed to repair message_logs:", err);
          // If repair fails, best to drop it so it gets recreated empty rather than leaving it broken
          db.exec("DROP TABLE IF EXISTS message_logs_broken");
          db.exec("DROP TABLE IF EXISTS message_logs");
        }
      }
    } catch (e) {
      console.warn("Error checking for broken FKs:", e);
    }

    // Check if 'paused' status is supported
    try {
      // Ensure table exists first
      const schInfo = db.prepare("PRAGMA table_info(schedules)").all() as any[];
      if (schInfo.length > 0) {
        db.exec("BEGIN TRANSACTION");
        const testStmt = db.prepare(
          "INSERT INTO schedules (type, contactName, message, status) VALUES ('once', 'test', 'test', 'paused')"
        );
        try {
          testStmt.run();
          db.exec("ROLLBACK");
        } catch (e: any) {
          db.exec("ROLLBACK");
          if (e.message && e.message.includes("CHECK constraint failed")) {
            console.log(
              "Detected missing 'paused' status support. Migrating schedules table while PRESERVING data..."
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

            // 4. Update foreign keys in message_logs
            // SQLite creates an implicit reference to the renamed table (schedules_old) when renaming.
            // We MUST recreate message_logs to point to the new 'schedules' table.
            db.exec("ALTER TABLE message_logs RENAME TO message_logs_old");

            db.exec(`
              CREATE TABLE IF NOT EXISTS message_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                scheduleId INTEGER,
                type TEXT NOT NULL CHECK(type IN ('instant', 'once', 'recurring')),
                contactName TEXT NOT NULL,
                message TEXT NOT NULL,
                status TEXT NOT NULL CHECK(status IN ('sending', 'sent', 'failed')),
                timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
                error TEXT,
                FOREIGN KEY (scheduleId) REFERENCES schedules(id) ON DELETE CASCADE
              );
            `);

            db.exec(`
              INSERT INTO message_logs (id, scheduleId, type, contactName, message, status, timestamp, error)
              SELECT id, scheduleId, type, contactName, message, status, timestamp, error
              FROM message_logs_old
            `);

            db.exec("DROP TABLE message_logs_old");

            // 5. Drop old table
            db.exec("DROP TABLE schedules_old");

            console.log("Migration completed. Data preserved.");
          }
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

  // Schema migration for contacts table (add companyName)
  try {
    const contactsInfo = db
      .prepare("PRAGMA table_info(contacts)")
      .all() as any[];
    // Only verify if table exists
    if (contactsInfo.length > 0) {
      const hasCompany = contactsInfo.some((col) => col.name === "companyName");
      if (!hasCompany) {
        console.log("Adding companyName column to contacts...");
        db.exec("ALTER TABLE contacts ADD COLUMN companyName TEXT");
      }
    }
  } catch (err) {
    console.warn("Error migrating contacts schema:", err);
  }

  // Contacts Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      number TEXT NOT NULL,
      email TEXT,
      companyName TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Broadcasts Schema Migration
  try {
    const broadcastsInfo = db
      .prepare("PRAGMA table_info(broadcasts)")
      .all() as any[];
    if (broadcastsInfo.length > 0) {
      const hasType = broadcastsInfo.some((col) => col.name === "type");
      if (!hasType) {
        console.log("Adding recurrence columns to broadcasts...");
        db.exec("ALTER TABLE broadcasts ADD COLUMN type TEXT DEFAULT 'once'");
        db.exec("ALTER TABLE broadcasts ADD COLUMN intervalValue INTEGER");
        db.exec("ALTER TABLE broadcasts ADD COLUMN intervalUnit TEXT");
        db.exec("ALTER TABLE broadcasts ADD COLUMN nextRun TEXT");
        db.exec("ALTER TABLE broadcasts ADD COLUMN lastRun TEXT");
      }
    }
  } catch (err) {
    console.warn("Error migrating broadcasts schema:", err);
  }

  // Add attachmentPath migration
  try {
    const broadcastsInfo = db
      .prepare("PRAGMA table_info(broadcasts)")
      .all() as any[];
    if (broadcastsInfo.length > 0) {
      const hasAttachment = broadcastsInfo.some(
        (col) => col.name === "attachmentPath"
      );
      if (!hasAttachment) {
        console.log("Adding attachmentPath column to broadcasts...");
        db.exec("ALTER TABLE broadcasts ADD COLUMN attachmentPath TEXT");
      }
      const hasAttachmentName = broadcastsInfo.some(
        (col) => col.name === "attachmentName"
      );
      if (!hasAttachmentName) {
        console.log("Adding attachmentName column to broadcasts...");
        db.exec("ALTER TABLE broadcasts ADD COLUMN attachmentName TEXT");
      }
    }
  } catch (err) {
    console.warn("Error migrating broadcasts attachment schema:", err);
  }

  // Broadcasts Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS broadcasts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'scheduled', 'processing', 'completed', 'failed')),
      scheduledTime TEXT,
      type TEXT DEFAULT 'once',
      intervalValue INTEGER,
      intervalUnit TEXT,
      nextRun TEXT,
      lastRun TEXT,
      attachmentPath TEXT,
      attachmentName TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Broadcast Recipients Link Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS broadcast_recipients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      broadcastId INTEGER NOT NULL,
      contactId INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'sent', 'failed')),
      sentAt TEXT,
      error TEXT,
      FOREIGN KEY (broadcastId) REFERENCES broadcasts(id) ON DELETE CASCADE,
      FOREIGN KEY (contactId) REFERENCES contacts(id) ON DELETE CASCADE
    );
  `);

  console.log("Migrations applied successfully.");
}
