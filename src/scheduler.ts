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
  disablePrefix?: boolean;
  scheduleId?: string;
}) => Promise<void>;

export class Scheduler {
  private schedules: Schedule[] = [];
  private tz: string = "UTC";
  private timer: NodeJS.Timeout | null = null;
  private sendFn!: ScheduleSendFn;

  async init(): Promise<void> {
    const file = await getSchedules();
    this.schedules = file.schedules;
    this.tz = file.meta.tz;
    await this.normalizeSchedules();
  }

  /**
   * Normalise schedule objects after load: compute nextRunAt for
   * recurring jobs, initialise missing fields and run overdue
   * one‑off jobs.
   */
  private async normalizeSchedules(): Promise<void> {
    const nowDt = now(this.tz);
    for (const sched of this.schedules) {
      // Fill missing optional properties
      sched.failures = sched.failures ?? 0;
      sched.lastRunAt = sched.lastRunAt ?? null;
      // For one‑off schedules with no interval
      if (!sched.intervalMinutes) {
        if (sched.active && new Date(sched.firstRunAt) <= nowDt) {
          // It should have been run but missed; mark as inactive and leave lastRunAt null
          sched.active = false;
        }
        sched.nextRunAt = sched.firstRunAt;
      } else {
        // Recurring schedule; compute nextRunAt if missing or overdue
        if (!sched.nextRunAt) {
          sched.nextRunAt = sched.firstRunAt;
        }
        const intervalMs = sched.intervalMinutes * 60000;
        let next = new Date(sched.nextRunAt);
        // Bump nextRunAt until it's in the future plus small buffer
        while (sched.active && next.getTime() <= nowDt.getTime() + 10000) {
          next = new Date(next.getTime() + intervalMs);
        }
        sched.nextRunAt = toIso(next);
      }
    }
    await this.persist();
  }

  /**
   * Persist current schedules to disk.
   */
  private async persist(): Promise<void> {
    const file: SchedulesFile = {
      schedules: this.schedules,
      meta: { tz: this.tz },
    };
    await saveSchedules(file);
  }

  /**
   * Start the scheduler loop. Accepts a send function which will be
   * called to execute schedules. The caller should ensure this
   * function respects rate limiting and prefix rules.
   */
  start(sendFn: ScheduleSendFn): void {
    this.sendFn = sendFn;
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.tick().catch((err) => console.error("Scheduler tick error", err));
    }, 30000);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Scheduler tick. Invoked periodically to check for due jobs and
   * execute them. Skips inactive schedules.
   */
  private async tick(): Promise<void> {
    const nowDt = now(this.tz);
    for (const sched of this.schedules) {
      if (!sched.active) continue;
      const next = new Date(sched.nextRunAt);
      if (next <= nowDt) {
        try {
          await this.sendFn({
            phone: sched.phone,
            name: sched.name,
            text: sched.text,
            disablePrefix: sched.disablePrefix,
            scheduleId: sched.id,
          });
          sched.lastRunAt = toIso(nowDt);
        } catch (err) {
          sched.failures++;
          console.error("Schedule execution failed", err);
        }
        if (sched.intervalMinutes) {
          // recurring; schedule next interval
          const nextDate = new Date(
            next.getTime() + sched.intervalMinutes * 60000,
          );
          sched.nextRunAt = toIso(nextDate);
        } else {
          // one‑off; deactivate
          sched.active = false;
        }
        await this.persist();
      }
    }
  }

  /**
   * List all schedules.
   */
  list(): Schedule[] {
    return this.schedules;
  }

  get(id: string): Schedule | undefined {
    return this.schedules.find((s) => s.id === id);
  }

  /**
   * Create a new schedule. Returns the created schedule. Will
   * compute nextRunAt based on firstRunAt and interval. Interval
   * minutes less than 60 will be clamped to 60.
   */
  async create(dto: ScheduleDto): Promise<Schedule> {
    const firstRunAt = dto.firstRunAt ? new Date(dto.firstRunAt) : now(this.tz);
    const intervalMinutes = clampInterval(dto.intervalMinutes);
    const schedule: Schedule = {
      id: uuid(),
      phone: dto.phone,
      name: dto.name,
      text: dto.text,
      disablePrefix: dto.disablePrefix ?? false,
      firstRunAt: toIso(firstRunAt),
      nextRunAt: toIso(firstRunAt),
      intervalMinutes,
      active: dto.active ?? true,
      lastRunAt: null,
      failures: 0,
      createdAt: toIso(now(this.tz)),
    };
    // Compute nextRunAt beyond now for recurring jobs
    if (schedule.intervalMinutes) {
      const intervalMs = schedule.intervalMinutes * 60000;
      let next = new Date(schedule.nextRunAt);
      while (
        schedule.active &&
        next.getTime() <= now(this.tz).getTime() + 10000
      ) {
        next = new Date(next.getTime() + intervalMs);
      }
      schedule.nextRunAt = toIso(next);
    }
    this.schedules.push(schedule);
    await this.persist();
    return schedule;
  }

  /**
   * Update a schedule by id. Only provided fields will be updated.
   */
  async update(
    id: string,
    updates: Partial<ScheduleDto>,
  ): Promise<Schedule | undefined> {
    const sched = this.get(id);
    if (!sched) return undefined;
    if (updates.phone !== undefined) sched.phone = updates.phone;
    if (updates.name !== undefined) sched.name = updates.name;
    if (updates.text) sched.text = updates.text;
    if (typeof updates.disablePrefix === "boolean")
      sched.disablePrefix = updates.disablePrefix;
    if (typeof updates.active === "boolean") sched.active = updates.active;
    if (updates.firstRunAt) {
      sched.firstRunAt = updates.firstRunAt;
    }
    if (updates.intervalMinutes !== undefined) {
      sched.intervalMinutes = clampInterval(updates.intervalMinutes);
    }
    // Recalculate nextRunAt after updating time or interval
    const nowDt = now(this.tz);
    const nextBase = new Date(sched.firstRunAt);
    if (!sched.intervalMinutes) {
      sched.nextRunAt = sched.firstRunAt;
    } else {
      const intervalMs = sched.intervalMinutes * 60000;
      let next = new Date(sched.nextRunAt ?? sched.firstRunAt);
      while (sched.active && next.getTime() <= nowDt.getTime() + 10000) {
        next = new Date(next.getTime() + intervalMs);
      }
      sched.nextRunAt = toIso(next);
    }
    await this.persist();
    return sched;
  }

  async delete(id: string): Promise<boolean> {
    const index = this.schedules.findIndex((s) => s.id === id);
    if (index < 0) return false;
    this.schedules.splice(index, 1);
    await this.persist();
    return true;
  }

  async pause(id: string): Promise<boolean> {
    const sched = this.get(id);
    if (!sched) return false;
    sched.active = false;
    await this.persist();
    return true;
  }

  async resume(id: string): Promise<boolean> {
    const sched = this.get(id);
    if (!sched) return false;
    sched.active = true;
    // Recompute next run to be at least interval from now
    await this.update(id, {});
    return true;
  }

  async runNow(id: string): Promise<boolean> {
    const sched = this.get(id);
    if (!sched) return false;
    if (!this.sendFn) return false;
    try {
      await this.sendFn({
        phone: sched.phone,
        name: sched.name,
        text: sched.text,
        disablePrefix: sched.disablePrefix,
        scheduleId: sched.id,
      });
      sched.lastRunAt = toIso(now(this.tz));
      if (sched.intervalMinutes) {
        const next = new Date(sched.lastRunAt);
        sched.nextRunAt = toIso(
          new Date(next.getTime() + sched.intervalMinutes * 60000),
        );
      } else {
        sched.active = false;
      }
      await this.persist();
      return true;
    } catch (err) {
      sched.failures++;
      await this.persist();
      console.error("RunNow failed", err);
      return false;
    }
  }
}
