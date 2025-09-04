/*
 * Shared type definitions across the backend of the WhatsApp bot.
 * These interfaces describe the shape of configuration files,
 * API payloads and internal entities. Keeping them centrally
 * defined helps catch errors at compile time and allows both the
 * server and the admin UI to import the same definitions when
 * needed.
 */

/**
 * Configuration for the message prefix feature.
 * This allows automatically prepending a string of text to all outgoing
 * messages, which can be useful for disclaimers or branding.
 */
export interface PrefixConfig {
  /** The text to be prepended to messages. */
  text: string;
  /** If true, the prefix is applied by default unless explicitly disabled for a message. */
  defaultEnabled: boolean;
}

/**
 * Configuration for the rate limiter.
 * Defines the per-minute and per-day sending limits, and controls the
 * warm-up behavior.
 */
export interface RateConfig {
  /** The maximum number of messages that can be sent per minute. */
  perMin: number;
  /** The maximum number of messages that can be sent in a 24-hour period. */
  perDay: number;
  /** If true, enables a warm-up period with stricter limits for the first few days. */
  warmup: boolean;
  /** The ISO timestamp of the first run, used to calculate the current warm-up tier. */
  firstRunAt: string | null;
}

/**
 * VAPID keys for web push notifications.
 * These keys are used to authenticate the application server to the push service.
 */
export interface VapidConfig {
  publicKey: string;
  privateKey: string;
}

/**
 * Main application settings.
 * This interface brings together all the configurable aspects of the bot,
 * such as browser behavior, rate limits, and push notifications.
 */
export interface Settings {
  /** If true, the Playwright browser runs in headless mode (without a visible UI). */
  headless: boolean;
  /** The timezone to be used for all date and time calculations, e.g., "America/New_York". */
  timezone: string;
  /** Rate limiting configuration. */
  rate: RateConfig;
  /** Message prefix configuration. */
  prefix: PrefixConfig;
  /** VAPID keys for web push. */
  vapid: VapidConfig;
  /** The number of top contacts to display in the admin UI. */
  topContactsN: 10 | 20;
  /** The interval in seconds for automatically refreshing the contact list. */
  contactsRefreshInterval?: number;
  /** The name of the contact to use for sending notifications to yourself. */
  selfContactName: string;
}

/**
 * Represents an entry in the send log file.
 * Each entry records the details of a message send attempt.
 */
export type SendLogEntry = {
  /** The ISO timestamp of the send attempt. */
  ts: string;
  /** The phone number of the recipient, if available. */
  phone?: string;
  /** The name of the recipient. */
  name?: string;
  /** A hash of the message text, for privacy and brevity. */
  textHash: string;
  /** The result of the send attempt. */
  result: "ok" | "error";
  /** The error message, if the send failed. */
  error?: string;
};

/**
 * The state of the rate limiter's token bucket.
 * This is persisted to disk to maintain rate limit state across restarts.
 */
export interface Limits {
  /** The number of tokens currently available in the bucket. */
  tokens: number;
  /** The Unix timestamp (in ms) when the token bucket was last updated. */
  updatedAt: number;
  /** The number of messages sent in the current day. */
  sentToday: number;
  /** The current day's date string (YYYY-MM-DD), used to detect day changes. */
  today: string;
}

/**
 * Data Transfer Object (DTO) for a send request.
 * This defines the shape of the JSON payload for the `/api/send` endpoint.
 */
export interface SendRequestDto {
  phone?: string;
  name?: string;
  text: string;
  enablePrefix?: boolean;
  idempotencyKey?: string;
}

/**
 * Data Transfer Object (DTO) for creating or updating a schedule.
 * This defines the shape of the JSON payload for the schedule-related API endpoints.
 */
export interface ScheduleDto {
  phone?: string;
  name?: string;
  text: string;
  enablePrefix?: boolean;
  firstRunAt?: string | null;
  intervalMinutes?: number | null;
  active?: boolean;
}

/**
 * Represents a scheduled message.
 * This is the internal representation of a schedule, including its state
 * and metadata, as stored in the schedules file.
 */
export interface Schedule {
  /** A unique identifier for the schedule. */
  id: string;
  /** The recipient's phone number, if available. */
  phone?: string;
  /** The recipient's name. */
  name?: string;
  /** The text of the message to be sent. */
  text: string;
  /** If true, the default prefix will be applied to this message. */
  enablePrefix: boolean;
  /** The ISO timestamp for the first time the message should be sent. */
  firstRunAt: string;
  /** The ISO timestamp for the next scheduled run. */
  nextRunAt: string;
  /** The interval in minutes for recurring schedules. Null for one-off messages. */
  intervalMinutes: number | null;
  /** If false, the schedule is paused and will not be run. */
  active: boolean;
  /** The ISO timestamp of the last time this schedule was successfully run. */
  lastRunAt: string | null;
  /** A counter for the number of consecutive times this schedule has failed to run. */
  failures: number;
  /** Number of times this schedule was skipped due to delay. */
  missedRuns: number;
  /** The ISO timestamp when the schedule was created. */
  createdAt: string;
}

/**
 * The structure of the schedules JSON file.
 */
export interface SchedulesFile {
  schedules: Schedule[];
  meta: {
    tz: string;
  };
}

/**
 * The state of the WhatsApp session.
 * This represents the current status of the connection to WhatsApp Web.
 */
export interface SessionState {
  /** A base64-encoded PNG of the QR code, if a relink is required. */
  qr: string | null;
  /** True if the bot is connected and ready to send messages. */
  ready: boolean;
  /** The ISO timestamp of the last time the bot became ready. */
  lastReadyAt: string | null;
}

/**
 * A web push subscription object.
 * This is the standard format for a push subscription provided by the browser.
 */
export interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

/**
 * The structure of the push subscriptions JSON file.
 */
export interface SubsFile {
  subs: PushSubscription[];
}

/**
 * The result of a send operation, as returned by the API.
 */
export type SendResult = {
  ok: boolean;
  id: string;
  error?: string;
};

/**
 * The response from the health check endpoint.
 */
export type HealthResponse = {
  session: SessionState;
  sentToday: number;
  perMinAvailable: number;
  dailyCap: number;
  headless: boolean;
};

/**
 * The result of a rate limit check.
 */
export interface LimitCheckResult {
  allowed: boolean;
  reason?: string;
}

/**
 * The context provided to the scheduler's run function.
 */
export interface SchedulerRunContext {
  now: Date;
}

/**
 * Represents an entry in a log file.
 */
export interface LogEntry {
  ts: string;
  phone: string;
  textHash: string;
  result: "ok" | "error";
  error?: string;
}

/**
 * Represents a contact.
 */
export interface Contact {
  name: string;
  phone?: string;
}

/**
 * The structure of the contacts JSON file.
 */
export interface ContactsFile {
  contacts: Contact[];
  lastRefreshed?: string;
}
