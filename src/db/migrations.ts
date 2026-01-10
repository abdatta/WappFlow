import Database from "better-sqlite3";

export function runMigrations(db: Database.Database) {
  // Schedules Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK(type IN ('instant', 'once', 'recurring')),
      phoneNumber TEXT NOT NULL,
      message TEXT NOT NULL,
      scheduleTime TEXT, -- ISO 8601 for 'once'
      cronExpression TEXT, -- for 'recurring'
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('pending', 'active', 'completed', 'failed', 'cancelled')),
      lastRun TEXT,
      nextRun TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
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

  // Add new columns for interval-based scheduling
  try {
    db.exec("ALTER TABLE schedules ADD COLUMN intervalValue INTEGER");
  } catch (e: any) {
    if (!e.message.includes("duplicate column")) console.error(e);
  }
  try {
    db.exec("ALTER TABLE schedules ADD COLUMN intervalUnit TEXT");
  } catch (e: any) {
    if (!e.message.includes("duplicate column")) console.error(e);
  }
  try {
    db.exec(
      "ALTER TABLE schedules ADD COLUMN toleranceMinutes INTEGER DEFAULT NULL",
    );
  } catch (e: any) {
    if (!e.message.includes("duplicate column")) console.error(e);
  }
}
