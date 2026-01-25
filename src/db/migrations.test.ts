import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations } from "./migrations";

describe("Database Migrations", () => {
  let db: Database.Database;

  beforeEach(() => {
    // strict: true matches what is used in migrations.ts (implicitly)
    // but better-sqlite3 defaults are usually fine.
    db = new Database(":memory:");
  });

  afterEach(() => {
    db.close();
  });

  it("should create all tables on a fresh database", () => {
    runMigrations(db);

    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
      )
      .all() as { name: string }[];

    const tableNames = tables.map((t) => t.name);
    expect(tableNames).toContain("schedules");
    expect(tableNames).toContain("message_logs");
    expect(tableNames).toContain("settings");
    expect(tableNames).toContain("subscriptions");
    expect(tableNames).toContain("feedbacks");

    // Verify columns in message_logs
    const messageLogsInfo = db
      .prepare("PRAGMA table_info(message_logs)")
      .all() as any[];
    // status should be there
    const statusCol = messageLogsInfo.find((c) => c.name === "status");
    expect(statusCol).toBeDefined();
  });

  it("should be idempotent (can run multiple times without error)", () => {
    runMigrations(db);
    expect(() => runMigrations(db)).not.toThrow();

    // Check tables again to be sure
    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
      )
      .all() as { name: string }[];
    expect(tables.length).toBeGreaterThan(0);
  });

  it("should migrate message_logs table if 'unknown' status is missing", () => {
    // 1. Setup legacy state (create table without 'unknown' in CHECK constraint)
    // Note: SQLite doesn't strictly enforce CHECK constraints unless we try to violate them,
    // but the migration logic parses the SQL from sqlite_master.
    // So we need to create the table with the OLD SQL definition.

    // OLD definition (without 'unknown')
    // We need 'schedules' table first for FK
    db.exec(`
      CREATE TABLE IF NOT EXISTS schedules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        contactName TEXT NOT NULL,
        message TEXT NOT NULL,
        scheduleTime TEXT,
        status TEXT NOT NULL,
        lastRun TEXT,
        nextRun TEXT,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        intervalValue INTEGER,
        intervalUnit TEXT,
        toleranceMinutes INTEGER
      );
    `);

    db.exec(`
      CREATE TABLE message_logs (
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

    // Insert some dummy data
    db.prepare(
      `
      INSERT INTO message_logs (type, contactName, message, status)
      VALUES ('instant', 'Alice', 'Hello', 'sent')
    `
    ).run();

    // Verify setup: Get SQL from sqlite_master
    const preMigrationSql = db
      .prepare("SELECT sql FROM sqlite_master WHERE name='message_logs'")
      .get() as { sql: string };
    expect(preMigrationSql.sql).not.toContain("'unknown'");

    // 2. Run Migrations
    runMigrations(db);

    // 3. Verify Migration
    const postMigrationSql = db
      .prepare("SELECT sql FROM sqlite_master WHERE name='message_logs'")
      .get() as { sql: string };
    // The new definition should contain 'unknown'
    expect(postMigrationSql.sql).toContain("'unknown'");

    // Data should be preserved
    const rows = db.prepare("SELECT * FROM message_logs").all() as any[];
    expect(rows.length).toBe(1);
    expect(rows[0].contactName).toBe("Alice");

    // Should be able to insert 'unknown' status now
    expect(() => {
      db.prepare(
        `
            INSERT INTO message_logs (type, contactName, message, status)
            VALUES ('instant', 'Bob', 'Unsure', 'unknown')
        `
      ).run();
    }).not.toThrow();
  });
});
