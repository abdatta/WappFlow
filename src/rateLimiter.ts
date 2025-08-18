/*
 * Rate limiter implementation. Uses a token bucket to enforce
 * per‑minute and per‑day limits. Supports warmup tiers based on
 * first run date. State is persisted to limits.json.
 */

import { getLimits, saveLimits, getSettings, saveSettings } from './store.js';
import { Limits, Settings, LimitCheckResult } from './types.js';
import { now } from './utils.js';

export class RateLimiter {
  private settings!: Settings;
  private limits!: Limits;
  private perMin!: number;
  private perDay!: number;

  /**
   * Initialise the rate limiter by loading settings and limits from
   * disk. This should be called once on startup. If the firstRunAt
   * property is null then it will be initialised with the current
   * timestamp and persisted.
   */
  async init(): Promise<void> {
    this.settings = await getSettings();
    this.limits = await getLimits();
    // Initialise firstRunAt on first run if warmup is enabled
    if (this.settings.rate.warmup && !this.settings.rate.firstRunAt) {
      const nowIso = new Date().toISOString();
      this.settings.rate.firstRunAt = nowIso;
      await saveSettings(this.settings);
    }
    this.recomputeCaps();
    // Ensure updatedAt is set
    if (!this.limits.updatedAt) {
      this.limits.updatedAt = Date.now();
    }
    if (!this.limits.today) {
      this.limits.today = new Date().toISOString().substring(0, 10);
    }
    await saveLimits(this.limits);
  }

  /**
   * Recompute per‑minute and per‑day caps based on warmup settings
   * and firstRunAt. This is called on init and when the day
   * changes.
   */
  private recomputeCaps(): void {
    const rc = this.settings.rate;
    // Default caps from settings
    let perMin = rc.perMin;
    let perDay = rc.perDay;
    if (rc.warmup && rc.firstRunAt) {
      const first = new Date(rc.firstRunAt);
      const diffMs = now(this.settings.timezone).getTime() - first.getTime();
      const days = Math.floor(diffMs / 86400000) + 1; // day count starting at 1
      if (days <= 2) {
        perMin = Math.min(perMin, 3);
        perDay = Math.min(perDay, 40);
      } else if (days <= 4) {
        perMin = Math.min(perMin, 5);
        perDay = Math.min(perDay, 80);
      } else {
        // full caps
      }
    }
    this.perMin = perMin;
    this.perDay = perDay;
    // When caps change we should also clamp tokens/sentToday
    if (this.limits.tokens > this.perMin) this.limits.tokens = this.perMin;
    if (this.limits.sentToday > this.perDay) this.limits.sentToday = this.perDay;
  }

  /**
   * Refill tokens based on time elapsed. Uses a constant refill rate
   * of perMin tokens per minute.
   */
  private refill(): void {
    const nowMs = Date.now();
    const elapsed = nowMs - this.limits.updatedAt;
    if (elapsed <= 0) return;
    const tokensToAdd = (this.perMin / 60000) * elapsed;
    this.limits.tokens = Math.min(this.perMin, this.limits.tokens + tokensToAdd);
    this.limits.updatedAt = nowMs;
  }

  /**
   * Reset daily counters when the day changes. Called before
   * processing tokens. Resets sentToday and tokens to full bucket.
   */
  private checkDayChange(): void {
    const tzNow = now(this.settings.timezone);
    const currentDay = tzNow.toISOString().substring(0, 10);
    if (currentDay !== this.limits.today) {
      this.limits.today = currentDay;
      this.limits.sentToday = 0;
      this.recomputeCaps();
      // Reset tokens to full for the new day
      this.limits.tokens = this.perMin;
    }
  }

  /**
   * Attempt to consume one token and increment daily usage. Returns
   * an object indicating whether sending is allowed. When allowed
   * equals false the reason field will contain a human friendly
   * explanation.
   */
  async consume(count: number = 1): Promise<LimitCheckResult> {
    this.checkDayChange();
    this.refill();
    if (this.limits.sentToday + count > this.perDay) {
      return { allowed: false, reason: 'Daily limit reached' };
    }
    if (this.limits.tokens < count) {
      return { allowed: false, reason: 'Rate limit exceeded' };
    }
    // Consume tokens and increment counts
    this.limits.tokens -= count;
    this.limits.sentToday += count;
    await saveLimits(this.limits);
    return { allowed: true };
  }

  /**
   * Get current token availability and caps without consuming.
   */
  getStatus() {
    this.checkDayChange();
    this.refill();
    return {
      tokens: Math.floor(this.limits.tokens),
      sentToday: this.limits.sentToday,
      perMin: this.perMin,
      perDay: this.perDay,
      today: this.limits.today
    };
  }
}