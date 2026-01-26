import cron from "node-cron";
import { Schedule } from "../../shared/types.js";
import db from "../db/db.js";
import { whatsappService, MessageUnknownError } from "./whatsapp.js";
import { notificationService } from "./notifications.js";

class SchedulerService {
  private tasks: Map<number, cron.ScheduledTask> = new Map();
  private runningTasks: Set<number> = new Set();

  init() {
    console.log("Initializing Scheduler...");
    this.loadSchedules();

    // Check schedules every minute (heartbeat)
    cron.schedule("* * * * *", () => {
      this.checkSchedules();
    });
  }

  loadSchedules() {
    console.log("Loading schedules... (Cron expressions removed)");
    // No-op: We only support interval-based recurring schedules which are picked up by checkSchedules
  }

  // scheduleRecurring removed as we no longer support cron expressions

  removeSchedule(id: number) {
    if (this.tasks.has(id)) {
      this.tasks.get(id)?.stop();
      this.tasks.delete(id);
    }
  }

  pauseSchedule(id: number) {
    console.log(`Pausing schedule ${id}...`);
    // Update DB: status = 'paused', nextRun = NULL
    db.prepare(
      "UPDATE schedules SET status = 'paused', nextRun = NULL WHERE id = ?"
    ).run(id);

    // Stop any in-memory tasks if we had them (legacy cron support but good cleanup)
    if (this.tasks.has(id)) {
      this.tasks.get(id)?.stop();
    }
  }

  resumeSchedule(id: number) {
    console.log(`Resuming schedule ${id}...`);

    const schedule = db
      .prepare("SELECT * FROM schedules WHERE id = ?")
      .get(id) as Schedule;
    if (!schedule) throw new Error("Schedule not found");

    if (schedule.type === "recurring" && schedule.intervalValue) {
      // Calculate next run based on original scheduleTime to preserve cadence
      const nextRunIso = this.updateNextRun(schedule, false);

      db.prepare("UPDATE schedules SET status = 'active' WHERE id = ?").run(id);

      console.log(`Resumed Schedule ${id}. Next run: ${nextRunIso}`);
    } else {
      // For one-time schedules, just active it. If it's in the past it will run immediately.
      db.prepare("UPDATE schedules SET status = 'active' WHERE id = ?").run(id);
    }
  }

  async checkSchedules() {
    const status = whatsappService.getStatus();
    if (!status.authenticated) {
      // console.log("Skipping schedule execution: WhatsApp not authenticated");
      return;
    }

    const now = new Date();
    const nowIso = now.toISOString();

    // Find active schedules due for execution
    const stmt = db.prepare(
      "SELECT * FROM schedules WHERE status = 'active' AND ((type = 'once' AND scheduleTime <= ?) OR (type = 'recurring' AND intervalValue IS NOT NULL AND nextRun <= ?))"
    );

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

          if (diffMinutes > s.toleranceMinutes) {
            console.warn(
              `Schedule ${s.id} skipped. Late by ${diffMinutes.toFixed(1)}m > tolerance ${s.toleranceMinutes}m`
            );
            const logId = this.createHistoryEntry(s, "sending");
            this.updateHistoryEntry(
              logId,
              "failed",
              `Skipped: Late by ${diffMinutes.toFixed(1)}m`
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
                  `Schedule ${s.id} now qualifies after nextRun update. Executing...`
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

  updateNextRun(schedule: Schedule, afterExecution: boolean = false): string {
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
      let tempDate = new Date(baseTime);
      let intervalsPassed = 0;
      while (tempDate.getTime() <= now.getTime()) {
        tempDate.setMonth(tempDate.getMonth() + schedule.intervalValue);
        if (tempDate.getTime() <= now.getTime()) {
          intervalsPassed++;
        }
      }

      // Default: baseTime + (intervalsPassed + 1) * interval
      // This is usually in the future relative to 'now' because of the loop condition
      nextDate = new Date(baseTime);
      nextDate.setMonth(
        nextDate.getMonth() + (intervalsPassed + 1) * schedule.intervalValue
      );

      // If we just executed and the calculated nextDate is still <= now (unlikely for months but safe to check), bump it
      // Actually months loop logic keeps it > now usually.
      // But if we are exactly on the edge?
    } else {
      // Calculate how many intervals have passed since baseTime
      const timeSinceBase = now.getTime() - baseTime.getTime();
      const intervalsPassed = Math.floor(timeSinceBase / intervalMs);

      // Calculate the time at the current interval (which aligns with 'now' or past)
      const currentIntervalTime = new Date(
        baseTime.getTime() + intervalsPassed * intervalMs
      );

      // If current interval time equals now (truncated), it means we are exactly in a slot.
      // If we just executed (afterExecution=true), we want the NEXT slot, so we don't repeat 'now'.
      // If we are late/skipping (afterExecution=false), we might want 'now' if it's a valid slot we caught up to.

      if (currentIntervalTime.getTime() === now.getTime()) {
        if (afterExecution) {
          // We finished this slot, move to next
          nextDate = new Date(
            baseTime.getTime() + (intervalsPassed + 1) * intervalMs
          );
        } else {
          // We are calculating potentially for catch-up, so this slot is valid
          nextDate = currentIntervalTime;
        }
      } else {
        // Next run is naturally the next one
        nextDate = new Date(
          baseTime.getTime() + (intervalsPassed + 1) * intervalMs
        );
      }
    }

    const nextRunIso = nextDate.toISOString();

    db.prepare("UPDATE schedules SET nextRun = ? WHERE id = ?").run(
      nextRunIso,
      schedule.id
    );

    // Update in-memory object to keep it in sync
    schedule.nextRun = nextRunIso;

    console.log(`Updated Schedule ${schedule.id} next run to ${nextRunIso}`);

    return nextRunIso;
  }

  async executeSchedule(schedule: Schedule, isRetry: boolean = false) {
    console.log(
      `Executing schedule ${schedule.id}${isRetry ? " (retry)" : ""}...`
    );

    // Mark as running
    this.runningTasks.add(schedule.id);

    const logId = this.createHistoryEntry(schedule, "sending");

    try {
      // Use contact-based sending logic
      await whatsappService.sendMessage(
        schedule.contactName,
        schedule.message,
        logId
      );

      // Update stats
      const now = new Date().toISOString();
      if (schedule.type === "once") {
        db.prepare(
          "UPDATE schedules SET status = 'completed', lastRun = ? WHERE id = ?"
        ).run(now, schedule.id);
      } else {
        db.prepare("UPDATE schedules SET lastRun = ? WHERE id = ?").run(
          now,
          schedule.id
        );
        // Calculate next run for interval schedules
        if (schedule.intervalValue) {
          this.updateNextRun(schedule, true); // Pass true to indicate successful execution
        }
      }

      this.updateHistoryEntry(logId, "sent");

      this.updateHistoryEntry(logId, "sent");

      notificationService.sendNotification({
        title: "Schedule Sent ✅",
        body: `Message to ${schedule.contactName} sent successfully.`,
      });
    } catch (err: any) {
      console.error(`Failed to execute schedule ${schedule.id}:`, err);

      let status: "failed" | "unknown" = "failed";
      if (err.name === "MessageUnknownError") {
        status = "unknown";
      }

      // Retry logic: retry once if we're still within tolerance (skip if unknown)
      if (
        status === "failed" &&
        !isRetry &&
        schedule.type === "recurring" &&
        schedule.nextRun
      ) {
        // ... (retry logic)
      }

      // Handle failure
      if (schedule.type === "once") {
        // If unknown, we still mark schedule as 'failed' (or completed?) in this simplistic model,
        // OR we just leave it active?
        // For 'once', usually we want to stop it. 'failed' stops it.
        db.prepare("UPDATE schedules SET status = 'failed' WHERE id = ?").run(
          schedule.id
        );
      } else if (schedule.type === "recurring" && schedule.intervalValue) {
        // For recurring tasks, update nextRun even on failure
        // so it won't keep trying the same failed run
        this.updateNextRun(schedule);
      }

      this.updateHistoryEntry(logId, status, err.message);

      notificationService.sendNotification({
        title: "Schedule Failed ❌",
        body: `Failed to send to ${schedule.contactName}: ${err.message}`,
      });
    } finally {
      // Always clean up running state
      this.runningTasks.delete(schedule.id);
    }
  }

  private createHistoryEntry(
    schedule: Schedule,
    status: "sending" | "sent" | "failed"
  ): number | bigint {
    const info = db
      .prepare(
        "INSERT INTO message_logs (scheduleId, type, contactName, message, status) VALUES (?, ?, ?, ?, ?)"
      )
      .run(
        schedule.id,
        schedule.type,
        schedule.contactName,
        schedule.message,
        status
      );
    return info.lastInsertRowid;
  }

  private updateHistoryEntry(
    logId: number | bigint,
    status: "sent" | "failed" | "unknown",
    error?: string
  ) {
    db.prepare(
      "UPDATE message_logs SET status = ?, error = ? WHERE id = ?"
    ).run(status, error || null, logId);
  }
}

export const schedulerService = new SchedulerService();
