/*
 * Rate limiter implementation. Uses a token bucket to enforce
 * per‑minute and per‑day limits. Supports warmup tiers based on
 * first run date. State is persisted to limits.json.
 */

import { getLimits, saveLimits, getSettings, saveSettings } from "./store.js";
import { Limits, Settings, LimitCheckResult } from "./types.js";
import { now } from "./utils.js";

/**
 * Implements a rate limiter using a token bucket algorithm.
 * This class is responsible for enforcing both per-minute and per-day
 * message sending limits. It supports a "warm-up" period where limits
 * are gradually increased over the first few days of operation to reduce
 * the risk of being flagged as spam. The state of the rate limiter,
 * including token counts and daily usage, is persisted to a JSON file.
 */
export class RateLimiter {
  private settings!: Settings;
  private limits!: Limits;
  // The effective per-minute and per-day caps, adjusted for warm-up.
  private perMin!: number;
  private perDay!: number;

  /**
   * Initializes the rate limiter.
   * This method loads the settings and current limits from the persistent
   * store. If this is the first time the bot is run with warm-up enabled,
   * it records the start time to calculate the warm-up tier.
   */
  async init(): Promise<void> {
    this.settings = await getSettings();
    this.limits = await getLimits();
    // If warm-up is enabled and this is the first run, set the `firstRunAt` timestamp.
    if (this.settings.rate.warmup && !this.settings.rate.firstRunAt) {
      const nowIso = new Date().toISOString();
      this.settings.rate.firstRunAt = nowIso;
      await saveSettings(this.settings);
    }
    this.recomputeCaps();
    // Initialize timestamps if they are not already set.
    if (!this.limits.updatedAt) {
      this.limits.updatedAt = Date.now();
    }
    if (!this.limits.today) {
      this.limits.today = new Date().toISOString().substring(0, 10);
    }
    await saveLimits(this.limits);
  }

  /**
   * Recalculates the sending caps based on the warm-up schedule.
   * If warm-up is enabled, this method adjusts the `perMin` and `perDay`
   * limits based on how many days the bot has been running. This helps
   * to build a good sending reputation.
   */
  private recomputeCaps(): void {
    const rc = this.settings.rate;
    // Start with the default caps from settings.
    let perMin = rc.perMin;
    let perDay = rc.perDay;
    // If in a warm-up period, apply stricter limits.
    if (rc.warmup && rc.firstRunAt) {
      const first = new Date(rc.firstRunAt);
      const diffMs = now(this.settings.timezone).getTime() - first.getTime();
      const days = Math.floor(diffMs / 86400000) + 1; // Day 1 is the first day.
      if (days <= 2) {
        perMin = Math.min(perMin, 3);
        perDay = Math.min(perDay, 40);
      } else if (days <= 4) {
        perMin = Math.min(perMin, 5);
        perDay = Math.min(perDay, 80);
      } else {
        // After the warm-up period, the full caps are used.
      }
    }
    this.perMin = perMin;
    this.perDay = perDay;
    // If the caps have been reduced, ensure the current token and usage counts
    // do not exceed the new caps.
    if (this.limits.tokens > this.perMin) this.limits.tokens = this.perMin;
    if (this.limits.sentToday > this.perDay)
      this.limits.sentToday = this.perDay;
  }

  /**
   * Refills the token bucket based on the time elapsed since the last refill.
   * The number of tokens added is proportional to the elapsed time, ensuring
   * a smooth and continuous refill rate up to the `perMin` cap.
   */
  private refill(): void {
    const nowMs = Date.now();
    const elapsed = nowMs - this.limits.updatedAt;
    if (elapsed <= 0) return;
    // Calculate how many tokens to add based on the per-minute rate.
    const tokensToAdd = (this.perMin / 60000) * elapsed;
    this.limits.tokens = Math.min(
      this.perMin,
      this.limits.tokens + tokensToAdd,
    );
    this.limits.updatedAt = nowMs;
  }

  /**
   * Checks if the day has changed and resets the daily counters if so.
   * This is crucial for enforcing the `perDay` limit. When a new day
   * starts, the `sentToday` count is reset to zero, and the token bucket
   * is refilled to its maximum capacity.
   */
  private checkDayChange(): void {
    const tzNow = now(this.settings.timezone);
    const currentDay = tzNow.toISOString().substring(0, 10);
    if (currentDay !== this.limits.today) {
      this.limits.today = currentDay;
      this.limits.sentToday = 0;
      this.recomputeCaps();
      // Reset the token bucket to full for the new day.
      this.limits.tokens = this.perMin;
    }
  }

  /**
   * Attempts to consume one or more tokens from the bucket.
   * This is the main method called before sending a message. It checks if
   * both the daily and per-minute limits would be respected. If allowed,
   * it decrements the token count and increments the daily sent count.
   *
   * @returns A `LimitCheckResult` object indicating if the send is allowed
   *          and, if not, the reason for the denial.
   */
  async consume(count: number = 1): Promise<LimitCheckResult> {
    this.checkDayChange();
    this.refill();
    if (this.limits.sentToday + count > this.perDay) {
      return { allowed: false, reason: "Daily limit reached" };
    }
    if (this.limits.tokens < count) {
      return { allowed: false, reason: "Rate limit exceeded" };
    }
    // If allowed, update the counts and save the new state.
    this.limits.tokens -= count;
    this.limits.sentToday += count;
    await saveLimits(this.limits);
    return { allowed: true };
  }

  /**
   * Returns the current status of the rate limiter.
   * This provides a snapshot of the current token count, daily usage,
   * and the active rate caps, which is useful for monitoring and UI display.
   */
  getStatus() {
    this.checkDayChange();
    this.refill();
    return {
      tokens: Math.floor(this.limits.tokens),
      sentToday: this.limits.sentToday,
      perMin: this.perMin,
      perDay: this.perDay,
      today: this.limits.today,
    };
  }
}
