/*
 * Shared type definitions across the backend of the WhatsApp bot.
 * These interfaces describe the shape of configuration files,
 * API payloads and internal entities. Keeping them centrally
 * defined helps catch errors at compile time and allows both the
 * server and the admin UI to import the same definitions when
 * needed.
 */

export interface PrefixConfig {
  /**
   * The text to prepend to every outgoing message when enabled.
   */
  text: string;
  /**
   * When true, the prefix is enabled by default for all sends.
   */
  defaultEnabled: boolean;
}

export interface RateConfig {
  /** Maximum number of messages allowed per minute. */
  perMin: number;
  /** Maximum number of messages allowed per day. */
  perDay: number;
  /** Whether warmup behaviour is enabled. */
  warmup: boolean;
  /** The ISO timestamp of the first run. Used to compute warmup tiers. */
  firstRunAt: string | null;
}

export interface VapidConfig {
  publicKey: string;
  privateKey: string;
}

export interface Settings {
  headless: boolean;
  timezone: string;
  rate: RateConfig;
  prefix: PrefixConfig;
  vapid: VapidConfig;
  topContactsN: 10 | 20;
  contactsRefreshInterval?: number;
}

export interface Limits {
  /** Current tokens available in the bucket. */
  tokens: number;
  /** Unix timestamp in milliseconds when the tokens were last updated. */
  updatedAt: number;
  /** Number of messages sent today. */
  sentToday: number;
  /** Date string (ISO, no time) representing the day the counters apply to. */
  today: string;
}

export interface SendRequestDto {
  phone?: string;
  name?: string;
  text: string;
  disablePrefix?: boolean;
  idempotencyKey?: string;
}

export interface ScheduleDto {
  phone?: string;
  name?: string;
  text: string;
  disablePrefix?: boolean;
  firstRunAt?: string | null;
  intervalMinutes?: number | null;
  active?: boolean;
}

export interface Schedule {
  /** Unique identifier for the schedule. */
  id: string;
  /** Contact phone number if available. */
  phone?: string;
  /** Contact name if phone is not known. */
  name?: string;
  /** Message text to send. */
  text: string;
  /** Whether to skip prefix when sending. */
  disablePrefix: boolean;
  /** ISO timestamp of the first execution. */
  firstRunAt: string;
  /** Next time the job should run (ISO). */
  nextRunAt: string;
  /** Interval in minutes. Null for one‑off schedules. */
  intervalMinutes: number | null;
  /** Whether the schedule is active. */
  active: boolean;
  /** Last run timestamp (ISO) or null. */
  lastRunAt: string | null;
  /** Number of times this schedule has failed. */
  failures: number;
  /** When the schedule was created. */
  createdAt: string;
}

export interface SchedulesFile {
  schedules: Schedule[];
  meta: {
    tz: string;
  };
}

export interface SessionState {
  /** Current QR code in base64 PNG format if a relink is required. */
  qr: string | null;
  /** Whether the bot is currently ready to send messages. */
  ready: boolean;
  /** Last time the bot became ready. */
  lastReadyAt: string | null;
}

export interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface SubsFile {
  subs: PushSubscription[];
}

export type SendResult = {
  ok: boolean;
  id: string;
  error?: string;
};

export type HealthResponse = {
  session: SessionState;
  sentToday: number;
  perMinAvailable: number;
  dailyCap: number;
  headless: boolean;
};

export interface LimitCheckResult {
  allowed: boolean;
  reason?: string;
}

export interface SchedulerRunContext {
  now: Date;
}

export interface LogEntry {
  ts: string;
  phone: string;
  textHash: string;
  result: "ok" | "error";
  error?: string;
}

export interface Contact {
  name: string;
  phone?: string;
}

export interface ContactsFile {
  contacts: Contact[];
  lastRefreshed?: string;
}
