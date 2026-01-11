import cron from "node-cron";
import { Schedule } from "../../shared/types.js";
import db from "../db/db.js";
import { whatsappService } from "./whatsapp.js";

class SchedulerService {
  private tasks: Map<number, cron.ScheduledTask> = new Map();
  private runningTasks: Set<number> = new Set();

  constructor() {}

  init() {
    console.log("Initializing Scheduler...");
    this.loadSchedules();

    // Check schedules every minute (heartbeat)
    cron.schedule("* * * * *", () => {
      this.checkSchedules();
    });
  }

  loadSchedules() {
    // Load all active recurring schedules
    const stmt = db.prepare(
      "SELECT * FROM schedules WHERE type = 'recurring' AND status = 'active' AND cronExpression IS NOT NULL",
    );
    const schedules = stmt.all() as Schedule[];

    schedules.forEach((s) => this.scheduleRecurring(s));
  }

  scheduleRecurring(schedule: Schedule) {
    if (!schedule.cronExpression) return;

    // Stop existing task if any (e.g. after update)
    if (this.tasks.has(schedule.id)) {
      this.tasks.get(schedule.id)?.stop();
    }

    if (!cron.validate(schedule.cronExpression)) {
      console.error(`Invalid cron expression for schedule ${schedule.id}`);
      return;
    }

    const task = cron.schedule(schedule.cronExpression, () => {
      this.executeSchedule(schedule);
    });

    this.tasks.set(schedule.id, task);
    console.log(
      `Scheduled recurring task ${schedule.id}: ${schedule.cronExpression}`,
    );
  }

  removeSchedule(id: number) {
    if (this.tasks.has(id)) {
      this.tasks.get(id)?.stop();
      this.tasks.delete(id);
    }
  }

  async checkSchedules() {
    const now = new Date();
    const nowIso = now.toISOString();

    // Find active schedules due for execution
    // Includes 'once' schedules and 'recurring' interval-based schedules
    // (Cron-based are handled by node-cron tasks separately)
    const stmt = db.prepare(
      "SELECT * FROM schedules WHERE status = 'active' AND (type = 'once' OR (type = 'recurring' AND intervalValue IS NOT NULL)) AND (nextRun <= ? OR (type = 'once' AND scheduleTime <= ?))",
    );
    // For 'once', we use scheduleTime if nextRun is null (legacy compat), but typically mapped.
    // Actually, let's simplify: 'once' uses scheduleTime. 'recurring' interval uses nextRun.
    // Improved Query:
    // 1. 'once' due: scheduleTime <= now
    // 2. 'recurring' interval due: nextRun <= now
    const schedules = (stmt.all(nowIso, nowIso) as Schedule[]).filter((s) => {
      if (s.type === "once") return s.scheduleTime && s.scheduleTime <= nowIso;
      if (s.type === "recurring") return s.nextRun && s.nextRun <= nowIso;
      return false;
    });

    for (const s of schedules) {
      // Skip if already running (prevents overlapping executions)
      if (this.runningTasks.has(s.id)) {
        console.log(`Schedule ${s.id} is already running, skipping this tick`);
        continue;
      }

      if (s.type === "recurring" && s.intervalValue && s.nextRun) {
        // Check Tolerance
        if (s.toleranceMinutes !== null && s.toleranceMinutes !== undefined) {
          const scheduledTime = new Date(s.nextRun).getTime();
          const diffMinutes = (now.getTime() - scheduledTime) / 1000 / 60;

          // Changed from > to >= so that diffMinutes equal to tolerance is also skipped
          if (diffMinutes >= s.toleranceMinutes) {
            console.warn(
              `Schedule ${s.id} skipped. Late by ${diffMinutes.toFixed(1)}m >= tolerance ${s.toleranceMinutes}m`,
            );
            this.logResult(
              s.id,
              "failed",
              `Skipped: Late by ${diffMinutes.toFixed(1)}m`,
            );

            // Update nextRun (updates both DB and in-memory object)
            this.updateNextRun(s);

            // Recheck: Does the NEW nextRun qualify for execution in current tick?
            if (s.nextRun && s.nextRun <= nowIso) {
              const newScheduledTime = new Date(s.nextRun).getTime();
              const newDiffMinutes =
                (now.getTime() - newScheduledTime) / 1000 / 60;

              // Check if new time is within tolerance
              if (newDiffMinutes < s.toleranceMinutes) {
                console.log(
                  `Schedule ${s.id} now qualifies after nextRun update. Executing...`,
                );
                await this.executeSchedule(s);
              }
            }

            continue;
          }
        }
      }

      await this.executeSchedule(s);
    }
  }

  updateNextRun(schedule: Schedule): string {
    if (!schedule.intervalValue || !schedule.intervalUnit)
      return schedule.nextRun || "";

    // Use scheduleTime (first scheduled time) as the base, fallback to createdAt
    const baseTime = new Date(schedule.scheduleTime || schedule.createdAt);

    // Truncate current time to the start of the minute (set seconds and ms to 0)
    const now = new Date();
    now.setSeconds(0, 0);

    // Calculate interval in milliseconds
    let intervalMs = 0;
    switch (schedule.intervalUnit) {
      case "minute":
        intervalMs = schedule.intervalValue * 60 * 1000;
        break;
      case "hour":
        intervalMs = schedule.intervalValue * 60 * 60 * 1000;
        break;
      case "day":
        intervalMs = schedule.intervalValue * 24 * 60 * 60 * 1000;
        break;
      case "week":
        intervalMs = schedule.intervalValue * 7 * 24 * 60 * 60 * 1000;
        break;
      case "month":
        // For months, we'll handle differently below since they have variable days
        break;
    }

    let nextDate: Date;

    if (schedule.intervalUnit === "month") {
      // Handle months specially due to variable days
      nextDate = new Date(baseTime);

      // Find how many month intervals have passed
      // We need to iterate to correctly handle month boundaries (e.g., Feb 29th)
      let tempDate = new Date(baseTime);
      let intervalsPassed = 0;
      while (tempDate.getTime() <= now.getTime()) {
        tempDate.setMonth(tempDate.getMonth() + schedule.intervalValue);
        if (tempDate.getTime() <= now.getTime()) {
          // Only count if it's still in the past
          intervalsPassed++;
        }
      }

      // Set nextDate to the baseTime plus (intervalsPassed + 1) months
      nextDate = new Date(baseTime);
      nextDate.setMonth(
        nextDate.getMonth() + (intervalsPassed + 1) * schedule.intervalValue,
      );
    } else {
      // Calculate how many intervals have passed since baseTime
      const timeSinceBase = now.getTime() - baseTime.getTime();
      const intervalsPassed = Math.floor(timeSinceBase / intervalMs);

      // Calculate the time at the current interval
      const currentIntervalTime = new Date(
        baseTime.getTime() + intervalsPassed * intervalMs,
      );

      // If current interval time equals now (truncated), use it; otherwise use next
      if (currentIntervalTime.getTime() === now.getTime()) {
        nextDate = currentIntervalTime;
      } else {
        // Next run is baseTime + (intervalsPassed + 1) * interval
        nextDate = new Date(
          baseTime.getTime() + (intervalsPassed + 1) * intervalMs,
        );
      }
    }

    const nextRunIso = nextDate.toISOString();

    db.prepare("UPDATE schedules SET nextRun = ? WHERE id = ?").run(
      nextRunIso,
      schedule.id,
    );

    // Update in-memory object to keep it in sync
    schedule.nextRun = nextRunIso;

    console.log(`Updated Schedule ${schedule.id} next run to ${nextRunIso}`);

    return nextRunIso;
  }

  async executeSchedule(schedule: Schedule, isRetry: boolean = false) {
    console.log(
      `Executing schedule ${schedule.id}${isRetry ? " (retry)" : ""}...`,
    );

    // Mark as running
    this.runningTasks.add(schedule.id);

    try {
      await whatsappService.sendMessage(schedule.phoneNumber, schedule.message);

      // Update stats
      const now = new Date().toISOString();
      if (schedule.type === "once") {
        db.prepare(
          "UPDATE schedules SET status = 'completed', lastRun = ? WHERE id = ?",
        ).run(now, schedule.id);
      } else {
        db.prepare("UPDATE schedules SET lastRun = ? WHERE id = ?").run(
          now,
          schedule.id,
        );
        // Calculate next run for interval schedules
        if (schedule.intervalValue) {
          this.updateNextRun(schedule);
        }
      }

      this.logResult(schedule.id, "sent");

      // TODO: Send notification to user
    } catch (err: any) {
      console.error(`Failed to execute schedule ${schedule.id}:`, err);

      // Retry logic: retry once if we're still within tolerance
      if (!isRetry && schedule.type === "recurring" && schedule.nextRun) {
        // Check if we're still within tolerance for a retry
        const now = new Date();
        const scheduledTime = new Date(schedule.nextRun).getTime();
        const diffMinutes = (now.getTime() - scheduledTime) / 1000 / 60;

        if (
          schedule.toleranceMinutes === null ||
          schedule.toleranceMinutes === undefined ||
          diffMinutes < schedule.toleranceMinutes
        ) {
          console.log(
            `Retrying schedule ${schedule.id} (still within tolerance)...`,
          );
          this.runningTasks.delete(schedule.id); // Remove before retry
          await this.executeSchedule(schedule, true);
          return; // Exit early, the retry will handle cleanup
        }
      }

      // Handle failure
      if (schedule.type === "once") {
        db.prepare("UPDATE schedules SET status = 'failed' WHERE id = ?").run(
          schedule.id,
        );
      } else if (schedule.type === "recurring" && schedule.intervalValue) {
        // For recurring tasks, update nextRun even on failure
        // so it won't keep trying the same failed run
        this.updateNextRun(schedule);
      }

      this.logResult(schedule.id, "failed", err.message);
    } finally {
      // Always clean up running state
      this.runningTasks.delete(schedule.id);
    }
  }

  private logResult(
    scheduleId: number,
    status: "sent" | "failed",
    error?: string,
  ) {
    db.prepare(
      "INSERT INTO message_logs (scheduleId, status, error) VALUES (?, ?, ?)",
    ).run(scheduleId, status, error);
  }
}

export const schedulerService = new SchedulerService();
