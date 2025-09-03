/*
 * Data persistence helpers. This module abstracts reading and
 * writing JSON files in an atomic manner. All bot state is kept
 * in the ./data directory to avoid external infrastructure.
 */

import fs from "fs/promises";
import path from "path";
import {
  Settings,
  Limits,
  SubsFile,
  SessionState,
  SchedulesFile,
  ContactsFile,
  SendLogEntry,
} from "./types.js";
import { WhatsAppDriver } from "./driver.js";

const DATA_DIR = path.join(process.cwd(), "data");

/**
 * A generic function to read and parse a JSON file from the data directory.
 * It abstracts the file system access and JSON parsing, providing a typed
 * object as a result.
 * @param fileName The name of the JSON file to read (e.g., "settings.json").
 * @returns A promise that resolves to the parsed JSON object.
 */
async function readFileJson<T>(fileName: string): Promise<T> {
  const filePath = path.join(DATA_DIR, fileName);
  const data = await fs.readFile(filePath, { encoding: "utf8" });
  return JSON.parse(data) as T;
}

/**
 * A generic function to write a JSON object to a file in the data directory.
 * This function implements an atomic write operation by first writing to a
 * temporary file and then renaming it. This ensures that even if the process
 * crashes during the write, the original file is not left in a corrupted state.
 * @param fileName The name of the JSON file to write to.
 * @param obj The object to serialize and write.
 */
async function writeFileJson<T>(fileName: string, obj: T): Promise<void> {
  const filePath = path.join(DATA_DIR, fileName);
  const tmpPath = `${filePath}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(obj, null, 2), {
    encoding: "utf8",
  });
  await fs.rename(tmpPath, filePath);
}

export async function getSettings(): Promise<Settings> {
  return readFileJson<Settings>("settings.json");
}

export async function saveSettings(settings: Settings): Promise<void> {
  await writeFileJson("settings.json", settings);
}

export async function getLimits(): Promise<Limits> {
  return readFileJson<Limits>("limits.json");
}

export async function saveLimits(limits: Limits): Promise<void> {
  await writeFileJson("limits.json", limits);
}

export async function getSubs(): Promise<SubsFile> {
  return readFileJson<SubsFile>("subs.json");
}

export async function saveSubs(subs: SubsFile): Promise<void> {
  await writeFileJson("subs.json", subs);
}

export async function getSession(): Promise<SessionState> {
  return readFileJson<SessionState>("session.json");
}

export async function saveSession(session: SessionState): Promise<void> {
  await writeFileJson("session.json", session);
}

export async function getSchedules(): Promise<SchedulesFile> {
  return readFileJson<SchedulesFile>("schedules.json");
}

export async function saveSchedules(file: SchedulesFile): Promise<void> {
  await writeFileJson("schedules.json", file);
}

export async function getContacts(): Promise<ContactsFile> {
  try {
    return await readFileJson<ContactsFile>("contacts.json");
  } catch (err: any) {
    if (err.code === "ENOENT") {
      return { contacts: [] };
    }
    throw err;
  }
}

export async function saveContacts(file: ContactsFile): Promise<void> {
  await writeFileJson("contacts.json", file);
}

/**
 * Appends a log entry to the `sends.log.jsonl` file.
 * This log file uses the JSON Lines format, where each line is a separate
 * JSON object. This format is efficient for append-only logs. The function
 * also sends a notification to the "Me" contact in WhatsApp with the status
 * of the send operation, providing real-time feedback.
 * @param entry The log entry to append.
 * @param driver An optional `WhatsAppDriver` instance to send a status notification.
 */
export async function appendSendLog(
  entry: SendLogEntry,
  driver?: WhatsAppDriver,
): Promise<void> {
  const filePath = path.join(DATA_DIR, "sends.log.jsonl");
  const line = JSON.stringify(entry) + "\n";
  try {
    await fs.appendFile(filePath, line, { encoding: "utf8" });
    // If a driver is provided, send a real-time notification about the send status.
    if (driver) {
      const status = entry.result.toUpperCase();
      const target = entry.name || entry.phone || "Unknown";
      let logMsg = `[${status}] `;
      if (entry.result === "ok") {
        logMsg += `Message to ${target} sent.`;
      } else {
        logMsg += `Send to ${target} failed: ${entry.error}`;
      }
      // The notification is sent to the configured "self" contact.
      await driver.sendTextToContact(
        { name: driver.settings.selfContactName },
        logMsg,
      );
    }
  } catch (err) {
    // Failures in logging should not crash the application.
    console.error("Failed to write send log:", err);
  }
}
