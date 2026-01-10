import cron from "node-cron";
import db from "../db/db.js";
import { Schedule } from "../../shared/types.js";
import { whatsappService } from "./whatsapp.js";

class SchedulerService {
  private tasks: Map<number, cron.ScheduledTask> = new Map();

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
      if (s.type === "recurring" && s.intervalValue && s.nextRun) {
        // Check Tolerance
        if (s.toleranceMinutes) {
          const scheduledTime = new Date(s.nextRun).getTime();
          const diffMinutes = (now.getTime() - scheduledTime) / 1000 / 60;

          if (diffMinutes > s.toleranceMinutes) {
            console.warn(
              `Schedule ${s.id} skipped. Late by ${diffMinutes.toFixed(1)}m > tolerance ${s.toleranceMinutes}m`,
            );
            this.logResult(
              s.id,
              "failed",
              `Skipped: Late by ${diffMinutes.toFixed(1)}m`,
            );
            this.updateNextRun(s);
            continue;
          }
        }
      }

      await this.executeSchedule(s);
    }
  }

  updateNextRun(schedule: Schedule) {
    if (!schedule.intervalValue || !schedule.intervalUnit) return;

    const currentRun = schedule.nextRun
      ? new Date(schedule.nextRun)
      : new Date();
    const nextDate = new Date(currentRun);

    switch (schedule.intervalUnit) {
      case "minute":
        nextDate.setMinutes(nextDate.getMinutes() + schedule.intervalValue);
        break;
      case "hour":
        nextDate.setHours(nextDate.getHours() + schedule.intervalValue);
        break;
      case "day":
        nextDate.setDate(nextDate.getDate() + schedule.intervalValue);
        break;
      case "week":
        nextDate.setDate(nextDate.getDate() + schedule.intervalValue * 7);
        break;
      case "month":
        nextDate.setMonth(nextDate.getMonth() + schedule.intervalValue);
        break;
    }

    db.prepare("UPDATE schedules SET nextRun = ? WHERE id = ?").run(
      nextDate.toISOString(),
      schedule.id,
    );
    console.log(
      `Updated Schedule ${schedule.id} next run to ${nextDate.toISOString()}`,
    );
  }

  async executeSchedule(schedule: Schedule) {
    console.log(`Executing schedule ${schedule.id}...`);

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

      // For one-time, maybe we retry? For now mark failed.
      if (schedule.type === "once") {
        db.prepare("UPDATE schedules SET status = 'failed' WHERE id = ?").run(
          schedule.id,
        );
      }

      this.logResult(schedule.id, "failed", err.message);
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
