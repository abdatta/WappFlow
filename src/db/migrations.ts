import Database from "better-sqlite3";

export function runMigrations(db: Database.Database) {
  // DROP tables to enforce schema change (Data Loss is expected/requested)
  try {
    const tableInfo = db.prepare("PRAGMA table_info(schedules)").all() as any[];
    // Check if we still have the old schema (e.g. cronExpression exists)
    const hasCron = tableInfo.some((col) => col.name === "cronExpression");

    if (hasCron) {
      console.log(
        "Detected old schema (cronExpression). Dropping tables to migrate...",
      );
      db.exec("DROP TABLE IF EXISTS message_logs");
      db.exec("DROP TABLE IF EXISTS schedules");
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

  // Message Logs Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS message_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scheduleId INTEGER NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('sent', 'failed')),
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
