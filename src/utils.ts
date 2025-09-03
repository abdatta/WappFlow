/*
 * Utility helpers for the WhatsApp bot. This module centralises
 * functions that are reused across the project. Keeping small,
 * focused helpers here helps reduce duplication and keeps the rest
 * of the code more readable.
 */

import { parsePhoneNumberFromString, AsYouType } from "libphonenumber-js";
import crypto from "node:crypto";

/**
 * Validates and normalizes a phone number to the E.164 international format.
 * This function uses the `libphonenumber-js` library to parse and validate
 * phone numbers. If the number is invalid, it throws an error. Otherwise,
 * it returns the number in the standardized E.164 format (e.g., "+12125552368").
 *
 * @param input The raw phone number string to validate.
 * @returns The normalized phone number in E.164 format.
 * @throws An error if the phone number is invalid.
 */
export function validatePhone(input: string): string {
  const num = parsePhoneNumberFromString(input);
  if (!num || !num.isValid()) {
    throw new Error("Invalid phone number");
  }
  return num.number;
}

/**
 * Generates a SHA-256 hash of a given string.
 * This is used to anonymize message content before logging, which is a good
 * practice for protecting user privacy.
 *
 * @param text The text to hash.
 * @returns A hex-encoded string of the SHA-256 hash.
 */
export function hashText(text: string): string {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

/**
 * A simple promise-based delay function.
 * This is an `async/await` friendly version of `setTimeout`. It's useful for
 * introducing pauses in automation scripts to mimic human behavior or to wait
 * for UI elements to update.
 *
 * @param ms The number of milliseconds to wait.
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generates a v4 UUID (Universally Unique Identifier).
 * This uses the built-in `crypto` module for a cryptographically strong
 * random UUID.
 */
export function uuid(): string {
  return crypto.randomUUID();
}

/**
 * Returns the current `Date` object, adjusted for a specific timezone.
 * This is important for ensuring that scheduled tasks run at the correct
 * local time for the user, regardless of the server's timezone.
 *
 * @param tz The IANA timezone name (e.g., "America/New_York").
 * @returns A `Date` object representing the current time in the specified timezone.
 */
export function now(tz?: string): Date {
  if (!tz) {
    return new Date();
  }
  // This is a common way to get a Date object for a specific timezone.
  // It creates a locale-specific date string and then parses it.
  const localeString = new Date().toLocaleString("en-US", { timeZone: tz });
  return new Date(localeString);
}

/**
 * Generates a random integer within a specified range (inclusive).
 */
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generates a random delay in seconds within a given range.
 * This is a convenience function built on top of `randomInt`.
 */
export function randomDelaySeconds(min: number, max: number): number {
  return randomInt(min, max);
}

/**
 * Removes all non-digit characters from a string.
 * This is useful for cleaning up phone numbers for display or for
 * creating a consistent format for comparison.
 */
export function stripPhoneFormatting(input: string): string {
  return input.replace(/\D+/g, "");
}

/**
 * Clamps a schedule interval to a minimum of 60 minutes.
 * If the input is `null` or `undefined`, it remains `null`. This prevents
 * setting up recurring schedules that run too frequently.
 */
export function clampInterval(
  minutes: number | null | undefined,
): number | null {
  if (minutes == null) return null;
  return Math.max(60, Math.floor(minutes));
}

/**
 * Converts a `Date` object to an ISO 8601 string.
 * This provides a standardized and unambiguous format for storing and
 * transmitting dates and times.
 */
export function toIso(dt: Date): string {
  return dt.toISOString();
}
