import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
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
    // Clear in-memory tasks
    (schedulerService as any).tasks = new Map();
    (schedulerService as any).runningTasks = new Set();
    vi.clearAllMocks();

    // Use fake timers to control time
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Basic Execution", () => {
    it("should execute a one-time schedule and mark it completed", async () => {
      const now = new Date();
      vi.setSystemTime(now);

      const scheduleTime = new Date(now.getTime() - 1000).toISOString(); // 1 sec ago
      const insertStmt = db.prepare(`
        INSERT INTO schedules (type, contactName, message, scheduleTime, status)
        VALUES ('once', 'Alice', 'Hello Once', ?, 'active')
      `);
      const { lastInsertRowid } = insertStmt.run(scheduleTime);

      await schedulerService.checkSchedules();

      expect(whatsappService.sendMessage).toHaveBeenCalledWith(
        "Alice",
        "Hello Once",
        expect.any(Number)
      );

      const updated = db
        .prepare("SELECT * FROM schedules WHERE id = ?")
        .get(lastInsertRowid) as any;
      expect(updated.status).toBe("completed");
      expect(updated.lastRun).toBeDefined();
    });

    it("should executing a recurring schedule and update nextRun", async () => {
      const now = new Date();
      now.setSeconds(0, 0); // Align to minute
      vi.setSystemTime(now);

      // Schedule for 'now' (or slightly past)
      const scheduleTime = new Date(now.getTime() - 1000).toISOString();

      const insertStmt = db.prepare(`
        INSERT INTO schedules (type, contactName, message, scheduleTime, intervalValue, intervalUnit, status, nextRun)
        VALUES ('recurring', 'Bob', 'Hello Recurring', ?, 1, 'hour', 'active', ?)
      `);
      // Initial nextRun is same as scheduleTime for first run
      const { lastInsertRowid } = insertStmt.run(scheduleTime, scheduleTime);

      await schedulerService.checkSchedules();

      expect(whatsappService.sendMessage).toHaveBeenCalledWith(
        "Bob",
        "Hello Recurring",
        expect.any(Number)
      );

      const updated = db
        .prepare("SELECT * FROM schedules WHERE id = ?")
        .get(lastInsertRowid) as any;
      expect(updated.status).toBe("active");

      // Should be next hour
      const nextRunDate = new Date(updated.nextRun);
      expect(nextRunDate.getTime()).toBeGreaterThan(now.getTime());

      const expectedNext = new Date(
        new Date(scheduleTime).getTime() + 60 * 60 * 1000
      );
      expectedNext.setSeconds(0, 0);
      // nextRun calculation truncates seconds of "now" but aligns intervals from base time...
      // Let's just check it advanced by roughly an hour
      expect(
        Math.abs(nextRunDate.getTime() - expectedNext.getTime())
      ).toBeLessThan(60000);
    });
  });

  describe("Interval Calculation", () => {
    const testInterval = async (
      unit: string,
      value: number,
      expectedMs: number
    ) => {
      const now = new Date(2025, 0, 1, 12, 0, 0); // Jan 1 2025 12:00:00
      vi.setSystemTime(now);

      // Base time was exactly 1 unit ago, so next run should be NOW (if catching up) or NOW + 1 (if successful)
      // Let's test "successful execution" path (updateNextRun(s, true))

      const schedule = {
        id: 1,
        type: "recurring",
        scheduleTime: new Date(now.getTime() - expectedMs).toISOString(),
        intervalValue: value,
        intervalUnit: unit as any,
        nextRun: new Date(now.getTime() - expectedMs).toISOString(),
        createdAt: new Date().toISOString(),
      };

      // Setup raw DB record for updateNextRun to work (it updates DB)
      db.prepare(
        `
            INSERT INTO schedules (id, type, contactName, message, scheduleTime, intervalValue, intervalUnit, status, nextRun)
            VALUES (?, 'recurring', 'Test', 'msg', ?, ?, ?, 'active', ?)
        `
      ).run(schedule.id, schedule.scheduleTime, value, unit, schedule.nextRun);

      const nextRunIso = schedulerService.updateNextRun(schedule as any, true);
      const nextRun = new Date(nextRunIso);

      // Expect next run to be NOW + expectedMs (since we just "ran" the one at NOW)
      const expectedNext = new Date(now.getTime() + expectedMs);
      expect(nextRun.toISOString()).toBe(expectedNext.toISOString());
    };

    it("updates minutes correctly", async () =>
      testInterval("minute", 15, 15 * 60 * 1000));
    it("updates hours correctly", async () =>
      testInterval("hour", 2, 2 * 60 * 60 * 1000));
    it("updates days correctly", async () =>
      testInterval("day", 1, 24 * 60 * 60 * 1000));
    it("updates weeks correctly", async () =>
      testInterval("week", 1, 7 * 24 * 60 * 60 * 1000));

    it("updates months correctly", async () => {
      const now = new Date(2025, 0, 15, 12, 0, 0); // Jan 15
      vi.setSystemTime(now);
      // Base: Dec 15
      const base = new Date(2024, 11, 15, 12, 0, 0);

      const schedule = {
        id: 1,
        type: "recurring",
        scheduleTime: base.toISOString(),
        intervalValue: 1,
        intervalUnit: "month",
        nextRun: base.toISOString(),
        createdAt: base.toISOString(),
      };

      db.prepare(
        `
            INSERT INTO schedules (id, type, contactName, message, scheduleTime, intervalValue, intervalUnit, status, nextRun)
            VALUES (?, 'recurring', 'Test', 'msg', ?, ?, ?, 'active', ?)
        `
      ).run(schedule.id, schedule.scheduleTime, 1, "month", schedule.nextRun);

      // If we execute successfully NOW (Jan 15), next should be Feb 15
      const nextRunIso = schedulerService.updateNextRun(schedule as any, true);

      expect(new Date(nextRunIso).toISOString()).toBe(
        new Date(2025, 1, 15, 12, 0, 0).toISOString()
      );
    });
  });

  describe("Tolerance & Catch-up", () => {
    it("should execute if within tolerance", async () => {
      const now = new Date();
      vi.setSystemTime(now);
      // Scheduled 5 mins ago, tolerance 10 mins
      const scheduleTime = new Date(
        now.getTime() - 5 * 60 * 1000
      ).toISOString();

      const insertStmt = db.prepare(`
            INSERT INTO schedules (type, contactName, message, scheduleTime, intervalValue, intervalUnit, status, nextRun, toleranceMinutes)
            VALUES ('recurring', 'User', 'Msg', ?, 1, 'hour', 'active', ?, 10)
          `);
      insertStmt.run(scheduleTime, scheduleTime);

      await schedulerService.checkSchedules();
      expect(whatsappService.sendMessage).toHaveBeenCalled();
    });

    it("should SKIP execution if outside tolerance", async () => {
      const now = new Date();
      vi.setSystemTime(now);
      // Scheduled 30 mins ago, tolerance 10 mins
      const scheduleTime = new Date(
        now.getTime() - 30 * 60 * 1000
      ).toISOString();

      const insertStmt = db.prepare(`
          INSERT INTO schedules (type, contactName, message, scheduleTime, intervalValue, intervalUnit, status, nextRun, toleranceMinutes)
          VALUES ('recurring', 'User', 'Msg', ?, 1, 'hour', 'active', ?, 10)
        `);
      const { lastInsertRowid } = insertStmt.run(scheduleTime, scheduleTime);

      await schedulerService.checkSchedules();

      expect(whatsappService.sendMessage).not.toHaveBeenCalled();

      // Should have logged a failure/skip
      const logs = db
        .prepare("SELECT * FROM message_logs WHERE scheduleId = ?")
        .all(lastInsertRowid) as any[];
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].status).toBe("failed"); // We mark skips as 'failed' in logs usually
      expect(logs[0].error).toMatch(/Skipped: Late by/);

      // Next run should be updated to future
      const updated = db
        .prepare("SELECT * FROM schedules WHERE id = ?")
        .get(lastInsertRowid) as any;
      expect(new Date(updated.nextRun).getTime()).toBeGreaterThan(
        now.getTime()
      );
    });
  });

  describe("Concurency & State", () => {
    it("should not double execute if task is running", async () => {
      const now = new Date();
      vi.setSystemTime(now);
      const scheduleTime = new Date(now.getTime() - 1000).toISOString();

      const insertStmt = db.prepare(`
            INSERT INTO schedules (type, contactName, message, scheduleTime, status, nextRun, intervalValue, intervalUnit)
            VALUES ('recurring', 'User', 'Msg', ?, 'active', ?, 1, 'hour')
          `);
      const { lastInsertRowid } = insertStmt.run(scheduleTime, scheduleTime);

      // Manually add to running tasks
      (schedulerService as any).runningTasks.add(lastInsertRowid);

      await schedulerService.checkSchedules();
      expect(whatsappService.sendMessage).not.toHaveBeenCalled();
    });
  });

  describe("Error Handling", () => {
    it("should handle generic failures and NOT advance for retry (unless skip logic changes)", async () => {
      const now = new Date();
      now.setSeconds(0, 0); // Align to minute
      vi.setSystemTime(now);
      const scheduleTime = now.toISOString(); // Exact alignment for retry logic verification

      const insertStmt = db.prepare(`
                INSERT INTO schedules (type, contactName, message, scheduleTime, intervalValue, intervalUnit, status, nextRun)
                VALUES ('recurring', 'RetryUser', 'Msg', ?, 1, 'hour', 'active', ?)
            `);
      const { lastInsertRowid } = insertStmt.run(scheduleTime, scheduleTime);

      vi.mocked(whatsappService.sendMessage).mockRejectedValue(
        new Error("Network Error")
      );

      await schedulerService.checkSchedules();

      // Should have tried
      expect(whatsappService.sendMessage).toHaveBeenCalled();

      // NextRun should likely be NOW (to retry) or close to it, NOT definitively the next interval
      // because currently we treat generic failure as updateNextRun(false) -> which might return same time if "now" is the slot

      const updated = db
        .prepare("SELECT * FROM schedules WHERE id = ?")
        .get(lastInsertRowid) as any;
      const nextRun = new Date(updated.nextRun);

      // logic: false -> if currentInterval == now -> return currentInterval
      // Since we mocked time to exactly match or close, it might stay same
      // This confirms we are NOT skipping to next, enabling a retry
      expect(nextRun.getTime()).toBeLessThanOrEqual(now.getTime() + 1000);
    });

    it("should handle unknown errors by treating as success (advancing to next)", async () => {
      const now = new Date();
      now.setSeconds(0, 0); // Align to minute to avoid updateNextRun truncation issues
      vi.setSystemTime(now);
      const scheduleTime = new Date(now.getTime() - 1000).toISOString();

      const insertStmt = db.prepare(`
                INSERT INTO schedules (type, contactName, message, scheduleTime, intervalValue, intervalUnit, status, nextRun)
                VALUES ('recurring', 'UnknownUser', 'Msg', ?, 1, 'hour', 'active', ?)
            `);
      const { lastInsertRowid } = insertStmt.run(scheduleTime, scheduleTime);

      vi.mocked(whatsappService.sendMessage).mockRejectedValue(
        new MessageUnknownError("Unknown")
      );

      await schedulerService.checkSchedules();

      // Should have tried
      expect(whatsappService.sendMessage).toHaveBeenCalled();

      const updated = db
        .prepare("SELECT * FROM schedules WHERE id = ?")
        .get(lastInsertRowid) as any;
      const nextRun = new Date(updated.nextRun);

      // Should be ~1 hour in future
      expect(nextRun.getTime()).toBeGreaterThan(now.getTime() + 30 * 60 * 1000);
    });
  });
});
