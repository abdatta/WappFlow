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
