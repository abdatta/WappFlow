import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import express from "express";
import Database from "better-sqlite3";
import { runMigrations } from "../db/migrations";

// Mock the DB module to use in-memory database
vi.mock("../db/db", () => {
  const db = new Database(":memory:");
  return { default: db };
});

// Mock services to prevent side effects during import
vi.mock("../services/notifications", () => ({
  notificationService: {
    sendNotification: vi.fn(),
    getStatus: vi.fn().mockReturnValue({ authenticated: true }),
  },
}));

vi.mock("../services/whatsapp", () => ({
  whatsappService: {
    sendMessage: vi.fn(),
    getStatus: vi.fn().mockReturnValue({ authenticated: true }),
  },
}));

// Import the router AFTER mocking so it uses the mocks
import schedulesRouter from "./schedules";
import db from "../db/db";

const app = express();
app.use(express.json());
app.use("/api/schedules", schedulesRouter);

describe("Schedules API", () => {
  beforeEach(() => {
    // Reset DB state before each test
    // Since it's in-memory, we can just drop tables and re-migrate, or just clear tables.
    // Re-running migrations is safest to ensure clean state.
    // But dropping tables might be tricky if we don't have a 'down' migration.
    // Easier: DELETE FROM schedules; DELETE FROM message_logs;

    // Ensure tables exist (first run might need this if we mocked globally)
    runMigrations(db);
    db.prepare("DELETE FROM schedules").run();
    db.prepare("DELETE FROM message_logs").run();
  });

  it("should calculate correct nextRun when resuming a recurring schedule", async () => {
    // 1. Create a recurring schedule
    // Let's say it started "yesterday" at 10:00 AM, runs every day.
    // Now is "today" 11:00 AM.
    // Properly, next run should be "tomorrow" 10:00 AM (if we just missed today's?)
    // Or if we pause it, and resume it, it should figure out the next slot.

    // Let's use specific dates to be deterministic.
    // We'll trust the logic uses 'new Date()' so we should mock system time if we want to be exact,
    // but the relative logic in `updateNextRun` uses the scheduleTime as anchor.

    const now = new Date();
    now.setSeconds(0, 0);
    // Anchor: 1 hour ago
    const scheduleTime = new Date(now.getTime() - 60 * 60 * 1000).toISOString();

    const insertStmt = db.prepare(`
      INSERT INTO schedules (type, contactName, message, scheduleTime, intervalValue, intervalUnit, status, nextRun)
      VALUES ('recurring', 'Test User', 'Hello', ?, 1, 'hour', 'active', ?)
    `);

    // nextRun would have been active.
    const runResult = insertStmt.run(scheduleTime, scheduleTime);
    const scheduleId = runResult.lastInsertRowid;

    // 2. Pause the schedule
    // We can call the API to pause, or do it directly in DB to setup the "bug" state (paused with null nextRun)
    // Using API is better integration test.

    await request(app)
      .patch(`/api/schedules/${scheduleId}/status`)
      .send({ status: "paused" })
      .expect(200);

    // Verify it is paused and nextRun is null
    const pausedSchedule = db
      .prepare("SELECT * FROM schedules WHERE id = ?")
      .get(scheduleId) as any;
    expect(pausedSchedule.status).toBe("paused");
    expect(pausedSchedule.nextRun).toBeNull();

    // 3. Resume the schedule
    await request(app)
      .patch(`/api/schedules/${scheduleId}/status`)
      .send({ status: "active" })
      .expect(200);

    // 4. Verify nextRun is correctly calculated based on anchor
    const resumedSchedule = db
      .prepare("SELECT * FROM schedules WHERE id = ?")
      .get(scheduleId) as any;
    expect(resumedSchedule.status).toBe("active");
    expect(resumedSchedule.nextRun).not.toBeNull();

    // The anchor was 1 hour ago. Interval is 1 hour.
    // So if it ran 1 hour ago (or was scheduled for 1 hour ago), the next run should be NOW (or close to it)
    // depending on the logic in updateNextRun.
    // Ideally, updateNextRun ensures it catches up to the *next* future slot or the *current* slot if accessible.

    const nextRunDate = new Date(resumedSchedule.nextRun);
    const scheduleTimeDate = new Date(scheduleTime);

    // Check minute alignment (should be same minute as scheduleTime)
    expect(nextRunDate.getMinutes()).toBe(scheduleTimeDate.getMinutes());
    expect(nextRunDate.getSeconds()).toBe(0); // It truncates seconds

    // It should be in the future (or very close to now if it just caught up)
    expect(nextRunDate.getTime()).toBeGreaterThanOrEqual(
      new Date().setSeconds(0, 0)
    );
  });

  it("should create a new recurring schedule", async () => {
    const res = await request(app).post("/api/schedules").send({
      type: "recurring",
      contactName: "John Doe",
      message: "Daily update",
      scheduleTime: new Date().toISOString(),
      intervalValue: 1,
      intervalUnit: "day",
    });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.type).toBe("recurring");
    expect(res.body.status).toBe("active");
  });
});
