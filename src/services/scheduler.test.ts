import { describe, it, expect, beforeEach, vi } from "vitest";
import { MessageUnknownError } from "./whatsapp";

// Mock DB
import Database from "better-sqlite3";
vi.mock("../db/db", () => {
  const db = new Database(":memory:");
  return { default: db };
});

// Mock dependencies
vi.mock("./whatsapp", () => ({
  whatsappService: {
    sendMessage: vi.fn(),
    getStatus: vi.fn().mockReturnValue({ authenticated: true }),
  },
  MessageUnknownError: class extends Error {
    constructor(message: string) {
      super(message);
      this.name = "MessageUnknownError";
    }
  },
}));

vi.mock("./notifications", () => ({
  notificationService: {
    sendNotification: vi.fn(),
  },
}));

import { schedulerService } from "./scheduler";
import { whatsappService } from "./whatsapp";
import db from "../db/db";
import { runMigrations } from "../db/migrations";

describe("SchedulerService", () => {
  beforeEach(() => {
    runMigrations(db);
    db.prepare("DELETE FROM schedules").run();
    db.prepare("DELETE FROM message_logs").run();
    vi.clearAllMocks();
  });

  it("should advance nextRun for recurring schedule when status is unknown (MessageUnknownError)", async () => {
    // 1. Setup recurring schedule
    const now = new Date();
    now.setSeconds(0, 0);
    const scheduleTime = new Date(now.getTime() - 60 * 60 * 1000).toISOString(); // 1 hour ago

    const insertStmt = db.prepare(`
      INSERT INTO schedules (type, contactName, message, scheduleTime, intervalValue, intervalUnit, status, nextRun)
      VALUES ('recurring', 'Test User', 'Hello', ?, 1, 'hour', 'active', ?)
    `);
    const runResult = insertStmt.run(scheduleTime, scheduleTime);
    const scheduleId = runResult.lastInsertRowid;

    // 2. Mock sendMessage to throw MessageUnknownError
    vi.mocked(whatsappService.sendMessage).mockRejectedValue(
      new MessageUnknownError("Unknown error")
    );

    // 3. get the schedule object
    const schedule = db
      .prepare("SELECT * FROM schedules WHERE id = ?")
      .get(scheduleId) as any;

    // 4. Execute
    await schedulerService.executeSchedule(schedule);

    // 5. Verify nextRun is advanced (should be in the future relative to scheduleTime)
    // If it was treated as failed (without my fix), it might not have been advanced passed the current slot properly
    // or it would be advanced using updateNextRun(schedule) (false), which might just be "now" if it's late.
    // With updateNextRun(schedule, true), it should definitely skip the current slot.

    const updatedSchedule = db
      .prepare("SELECT * FROM schedules WHERE id = ?")
      .get(scheduleId) as any;

    expect(updatedSchedule.status).toBe("active");

    const nextRunDate = new Date(updatedSchedule.nextRun);
    const expectedNextRun = new Date(now.getTime() + 60 * 60 * 1000); // Now + 1 hour (roughly, if we aligned to slots)
    // Actually, logic is: baseTime + (intervals + 1).
    // baseTime = 1 hour ago.
    // Interval = 1 hour.
    // 1 hour ago + 1*1h = NOW.
    // If we treat as success (true), we want NEXT slot: 1 hour ago + 2*1h = NOW + 1h.

    // If we treated as failure (false), it would calculate:
    // intervalsPassed = (now - base) / 1h = 1.
    // currentIntervalTime = base + 1 = NOW.
    // It would return NOW.

    // So we expect it to be > NOW.
    expect(nextRunDate.getTime()).toBeGreaterThan(now.getTime());
  });

  it("should NOT advance nextRun past current slot for recurring schedule when status is failed (generic error)", async () => {
    // 1. Setup recurring schedule (same as above)
    const now = new Date();
    now.setSeconds(0, 0);
    const scheduleTime = new Date(now.getTime() - 60 * 60 * 1000).toISOString(); // 1 hour ago

    const insertStmt = db.prepare(`
       INSERT INTO schedules (type, contactName, message, scheduleTime, intervalValue, intervalUnit, status, nextRun)
       VALUES ('recurring', 'Test User', 'Hello', ?, 1, 'hour', 'active', ?)
     `);
    const runResult = insertStmt.run(scheduleTime, scheduleTime);
    const scheduleId = runResult.lastInsertRowid;

    // 2. Mock sendMessage to throw Generic Error
    vi.mocked(whatsappService.sendMessage).mockRejectedValue(
      new Error("Generic error")
    );

    // 3. get
    const schedule = db
      .prepare("SELECT * FROM schedules WHERE id = ?")
      .get(scheduleId) as any;

    // 4. Execute
    await schedulerService.executeSchedule(schedule);

    // 5. Verify nextRun is NOT advanced aggressively (it might settle on 'now' to retry or catch up)
    // strict updateNextRun(false) behavior:
    // If currentIntervalTime === now, it returns currentIntervalTime. (Retry immediately/soon)

    const updatedSchedule = db
      .prepare("SELECT * FROM schedules WHERE id = ?")
      .get(scheduleId) as any;

    const nextRunDate = new Date(updatedSchedule.nextRun);

    // Expect it to be NOW (or close to logic start) because it's failed and late.
    // Note: The scheduler loop prevents double execution in same tick via runningTasks,
    // but the nextRun value itself should be 'ready' for retry.
    // Actually, looking at code:
    // if (currentIntervalTime.getTime() === now.getTime()) {
    //    if (afterExecution) { next = ... + 1 } else { next = currentIntervalTime }
    // }

    // So for generic error (afterExecution=false), nextRun should be NOW (currentIntervalTime).
    // For unknown error (afterExecution=true), nextRun should be NOW + 1h.

    expect(nextRunDate.getTime()).toBe(now.getTime());
  });
});
