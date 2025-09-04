/*
 * In‑process scheduler. Manages one‑off and recurring jobs stored in
 * schedules.json. Jobs are executed via a provided send
 * callback. The scheduler persists state after every mutation and
 * tick to ensure resilience across restarts. All times are stored
 * as ISO strings and comparisons are performed using the
 * configured timezone from settings.
 */

import { getSchedules, saveSchedules, getSettings } from "./store.js";
import { Schedule, ScheduleDto, SchedulesFile } from "./types.js";
import { clampInterval, now, toIso, uuid } from "./utils.js";

export type ScheduleSendFn = (payload: {
  phone?: string;
  name?: string;
  text: string;
  enablePrefix?: boolean;
  scheduleId?: string;
}) => Promise<void>;

/**
 * An in-process scheduler for sending messages.
 * This class manages one-off and recurring message schedules, which are
 * persisted in a JSON file. Each job is scheduled individually using
 * timers based on its next run time. The actual sending of messages is
 * delegated to a `sendFn` provided during initialization, which allows
 * the scheduler to be decoupled from the message sending logic (e.g.,
 * the WhatsApp driver).
 */
export class Scheduler {
  // In-memory list of all schedules.
  private schedules: Schedule[] = [];
  // The timezone used for all date/time calculations.
  private tz: string = "UTC";
  // Active timers for each scheduled job.
  private jobs: Map<string, NodeJS.Timeout> = new Map();
  // The function to call to execute a scheduled job.
  private sendFn!: ScheduleSendFn;

  /**
   * Initializes the scheduler.
   * Loads schedules from the persistent store and normalizes them, for example,
   * by calculating the `nextRunAt` time for recurring jobs.
   */
  async init(): Promise<void> {
    const file = await getSchedules();
    this.schedules = file.schedules;
    this.tz = file.meta.tz;
    await this.normalizeSchedules();
  }

  /**
   * Calculates the next run time for a schedule.
   * For recurring jobs, it calculates the next run time based on the interval
   * and the last run time, ensuring that missed jobs are correctly rescheduled.
   * For one-off jobs, it simply sets `nextRunAt` to `firstRunAt`.
   */
  private recalculateNextRun(sched: Schedule, nowDt: Date): void {
    if (!sched.intervalMinutes) {
      // This is a one-off job. If it's already past, deactivate it.
      if (sched.active && new Date(sched.firstRunAt) <= nowDt) {
        sched.active = false;
      }
      sched.nextRunAt = sched.firstRunAt;
    } else {
      // This is a recurring job.
      const firstRunAt = new Date(sched.firstRunAt);
      const intervalMs = sched.intervalMinutes * 60000;
      const nowMs = nowDt.getTime();
      if (firstRunAt.getTime() > nowMs) {
        // If the first run is in the future, schedule it for then.
        sched.nextRunAt = sched.firstRunAt;
        return;
      }
      // If the first run is in the past, calculate the next run time
      // based on the number of intervals that have passed.
      const elapsedMs = nowMs - firstRunAt.getTime();
      const intervalsPassed = Math.floor(elapsedMs / intervalMs);
      const nextRunMs =
        firstRunAt.getTime() + (intervalsPassed + 1) * intervalMs;
      sched.nextRunAt = toIso(new Date(nextRunMs));
    }
  }

  /**
   * Normalizes all loaded schedules.
   * This ensures that all schedule objects have a consistent structure,
   * with all optional fields initialized and `nextRunAt` correctly calculated.
   */
  private async normalizeSchedules(): Promise<void> {
    const nowDt = now(this.tz);
    for (const sched of this.schedules) {
      // Initialize optional properties if they are missing.
      sched.failures = sched.failures ?? 0;
      sched.lastRunAt = sched.lastRunAt ?? null;
      sched.missedRuns = sched.missedRuns ?? 0;
      (sched as any).enablePrefix = (sched as any).enablePrefix ?? false;
      this.recalculateNextRun(sched, nowDt);
    }
    await this.persist();
  }

  /**
   * Saves the current state of all schedules to the persistent store.
   */
  private async persist(): Promise<void> {
    const file: SchedulesFile = {
      schedules: this.schedules,
      meta: { tz: this.tz },
    };
    await saveSchedules(file);
  }

  /**
   * Starts the scheduler by setting up timers for all active schedules.
   */
  start(sendFn: ScheduleSendFn): void {
    this.sendFn = sendFn;
    for (const sched of this.schedules) {
      this.scheduleJob(sched);
    }
  }

  /** Stop all scheduled timers. */
  stop(): void {
    for (const t of this.jobs.values()) clearTimeout(t);
    this.jobs.clear();
  }

  /** Schedule a single job based on its `nextRunAt`. */
  private scheduleJob(sched: Schedule): void {
    // clear existing timer if any
    const existing = this.jobs.get(sched.id);
    if (existing) clearTimeout(existing);
    if (!sched.active) return;
    const nowDt = now(this.tz);
    const next = new Date(sched.nextRunAt);
    const delay = Math.max(0, next.getTime() - nowDt.getTime());
    const timer = setTimeout(() => {
      this.runJob(sched.id).catch((err) =>
        console.error("Scheduler job error", err),
      );
    }, delay);
    this.jobs.set(sched.id, timer);
  }

  /** Execute a scheduled job and reschedule if necessary. */
  private async runJob(id: string): Promise<void> {
    const sched = this.get(id);
    if (!sched || !sched.active) return;
    const nowDt = now(this.tz);
    const next = new Date(sched.nextRunAt);
    const scheduleTimeGraceMs = 60 * 1000;
    const lateMs = nowDt.getTime() - next.getTime();
    if (lateMs > scheduleTimeGraceMs) {
      const alertMsg = `Scheduler: Skipped message for ${
        sched.name || sched.phone
      } due to delay of ${Math.round(lateMs / 1000)}s.`;
      try {
        await this.sendFn({ name: "Me India (Vi)", text: alertMsg });
      } catch (e) {
        console.error("Failed to send schedule-delay alert", e);
      }
      sched.missedRuns++;
      if (sched.intervalMinutes) {
        const nextDate = new Date(
          next.getTime() + sched.intervalMinutes * 60000,
        );
        sched.nextRunAt = toIso(nextDate);
        await this.persist();
        this.scheduleJob(sched);
      } else {
        sched.active = false;
        await this.persist();
      }
      return;
    }

    try {
      await this.sendFn({
        phone: sched.phone,
        name: sched.name,
        text: sched.text,
        enablePrefix: sched.enablePrefix,
        scheduleId: sched.id,
      });
      sched.lastRunAt = toIso(nowDt);
    } catch (err) {
      sched.failures++;
      console.error("Schedule execution failed", err);
    }

    if (sched.intervalMinutes) {
      const nextDate = new Date(next.getTime() + sched.intervalMinutes * 60000);
      sched.nextRunAt = toIso(nextDate);
      await this.persist();
      this.scheduleJob(sched);
    } else {
      sched.active = false;
      await this.persist();
    }
  }

  /**
   * Returns a list of all schedules.
   */
  list(): Schedule[] {
    return this.schedules;
  }

  /**
   * Retrieves a single schedule by its ID.
   */
  get(id: string): Schedule | undefined {
    return this.schedules.find((s) => s.id === id);
  }

  /**
   * Creates a new schedule.
   * The `nextRunAt` time is calculated based on the provided `firstRunAt`
   * and `intervalMinutes`. The interval is clamped to a minimum of 60 minutes.
   */
  async create(dto: ScheduleDto): Promise<Schedule> {
    const firstRunAt = dto.firstRunAt ? new Date(dto.firstRunAt) : now(this.tz);
    const intervalMinutes = clampInterval(dto.intervalMinutes);
    const schedule: Schedule = {
      id: uuid(),
      phone: dto.phone,
      name: dto.name,
      text: dto.text,
      enablePrefix: dto.enablePrefix ?? false,
      firstRunAt: toIso(firstRunAt),
      nextRunAt: toIso(firstRunAt),
      intervalMinutes,
      active: dto.active ?? true,
      lastRunAt: null,
      failures: 0,
      missedRuns: 0,
      createdAt: toIso(now(this.tz)),
    };
    // Recalculate the next run time, especially for recurring jobs.
    this.recalculateNextRun(schedule, now(this.tz));
    this.schedules.push(schedule);
    await this.persist();
    this.scheduleJob(schedule);
    return schedule;
  }

  /**
   * Updates an existing schedule.
   * Only the fields provided in the `updates` object will be modified.
   * After updating, the `nextRunAt` time is recalculated.
   */
  async update(
    id: string,
    updates: Partial<ScheduleDto>,
  ): Promise<Schedule | undefined> {
    const sched = this.get(id);
    if (!sched) return undefined;
    // Apply the updates.
    if (updates.phone !== undefined) sched.phone = updates.phone;
    if (updates.name !== undefined) sched.name = updates.name;
    if (updates.text) sched.text = updates.text;
    if (typeof updates.enablePrefix === "boolean")
      sched.enablePrefix = updates.enablePrefix;
    if (typeof updates.active === "boolean") sched.active = updates.active;
    if (updates.firstRunAt) {
      sched.firstRunAt = updates.firstRunAt;
    }
    if (updates.intervalMinutes !== undefined) {
      sched.intervalMinutes = clampInterval(updates.intervalMinutes);
    }
    // After changing time-related properties, recalculate the next run.
    this.recalculateNextRun(sched, now(this.tz));
    await this.persist();
    this.scheduleJob(sched);
    return sched;
  }

  /**
   * Deletes a schedule by its ID.
   */
  async delete(id: string): Promise<boolean> {
    const index = this.schedules.findIndex((s) => s.id === id);
    if (index < 0) return false;
    const sched = this.schedules[index];
    const timer = this.jobs.get(sched.id);
    if (timer) clearTimeout(timer);
    this.jobs.delete(sched.id);
    this.schedules.splice(index, 1);
    await this.persist();
    return true;
  }

  /**
   * Pauses a schedule, preventing it from running.
   */
  async pause(id: string): Promise<boolean> {
    const sched = this.get(id);
    if (!sched) return false;
    sched.active = false;
    const timer = this.jobs.get(id);
    if (timer) clearTimeout(timer);
    this.jobs.delete(id);
    await this.persist();
    return true;
  }

  /**
   * Resumes a paused schedule.
   */
  async resume(id: string): Promise<boolean> {
    const sched = this.get(id);
    if (!sched) return false;
    sched.active = true;
    // Recalculate the next run time to ensure it's in the future.
    await this.update(id, {});
    return true;
  }

  /**
   * Triggers an immediate run of a scheduled message, regardless of its
   * scheduled time. After running, the schedule is updated as if it had
   * run at its normally scheduled time.
   */
  async runNow(id: string): Promise<boolean> {
    const sched = this.get(id);
    if (!sched) return false;
    if (!this.sendFn) return false;
    try {
      await this.sendFn({
        phone: sched.phone,
        name: sched.name,
        text: sched.text,
        enablePrefix: sched.enablePrefix,
        scheduleId: sched.id,
      });
      sched.lastRunAt = toIso(now(this.tz));
      // After a manual run, reschedule the next run for a recurring job.
      if (sched.intervalMinutes) {
        const next = new Date(sched.lastRunAt);
        sched.nextRunAt = toIso(
          new Date(next.getTime() + sched.intervalMinutes * 60000),
        );
        await this.persist();
        this.scheduleJob(sched);
      } else {
        // A one-off job is deactivated after running.
        sched.active = false;
        await this.persist();
      }
      return true;
    } catch (err) {
      sched.failures++;
      await this.persist();
      console.error("RunNow failed", err);
      return false;
    }
  }
}
