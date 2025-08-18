/*
 * Utility helpers for the WhatsApp bot. This module centralises
 * functions that are reused across the project. Keeping small,
 * focused helpers here helps reduce duplication and keeps the rest
 * of the code more readable.
 */

import { parsePhoneNumberFromString, AsYouType } from "libphonenumber-js";
import crypto from "node:crypto";

/**
 * Validate and normalise a phone number into E.164 format. Throws
 * if the phone number is invalid. Returns the cleaned E.164 string.
 */
export function validatePhone(input: string): string {
  const num = parsePhoneNumberFromString(input);
  if (!num || !num.isValid()) {
    throw new Error("Invalid phone number");
  }
  return num.number;
}

/**
 * Generate a SHA‑256 hash of the provided text. Useful for
 * anonymising message contents when logging.
 */
export function hashText(text: string): string {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

/**
 * Sleep for a given number of milliseconds. Returns a Promise
 * resolving after the delay. Use this to space out browser
 * interactions.
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate a v4 style UUID using the built‑in crypto API.
 */
export function uuid(): string {
  return crypto.randomUUID();
}

/**
 * Returns the current time in the provided timezone. When no
 * timezone is passed the local system timezone is used. Dates
 * returned are JavaScript Date objects anchored to UTC.
 */
export function now(tz?: string): Date {
  if (!tz) {
    return new Date();
  }
  // Convert local now to the desired timezone by constructing a
  // date string and letting the Date constructor parse it.
  const localeString = new Date().toLocaleString("en-US", { timeZone: tz });
  return new Date(localeString);
}

/**
 * Compute a random integer between min and max (inclusive).
 */
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Compute a random delay between the provided bounds in seconds.
 */
export function randomDelaySeconds(min: number, max: number): number {
  return randomInt(min, max);
}

/**
 * Strip non‑digit characters from a phone number. Useful for
 * presenting numbers in UI.
 */
export function stripPhoneFormatting(input: string): string {
  return input.replace(/\D+/g, "");
}

/**
 * Clamp a schedule interval to null or a minimum value of 60.
 */
export function clampInterval(
  minutes: number | null | undefined,
): number | null {
  if (minutes == null) return null;
  return Math.max(60, Math.floor(minutes));
}

/**
 * Format a Date to ISO string without milliseconds. This helps
 * produce consistent strings in JSON files.
 */
export function toIso(dt: Date): string {
  return dt.toISOString();
}
