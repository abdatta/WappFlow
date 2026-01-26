/**
 * Shared deployment status utilities
 *
 * Used by both the deploy API endpoint and the update script.
 */

import fs from "fs";
import path from "path";

export const STATUS_FILE = path.resolve("data/deploy-status.json");

export interface LogLine {
  text: string;
  overwritable?: boolean; // True for lines like npm progress bars that get overwritten
}

export interface DeployStatus {
  status: "idle" | "running" | "success" | "failed";
  startedAt?: string;
  completedAt?: string;
  error?: string;
  step?: string;
  logs?: LogLine[];
}

export function getDeployStatus(): DeployStatus {
  try {
    if (fs.existsSync(STATUS_FILE)) {
      return JSON.parse(fs.readFileSync(STATUS_FILE, "utf-8"));
    }
  } catch {
    // Ignore parse errors
  }
  return { status: "idle" };
}

export function setDeployStatus(status: Partial<DeployStatus>): void {
  const current = getDeployStatus();
  const updated = { ...current, ...status };
  fs.mkdirSync(path.dirname(STATUS_FILE), { recursive: true });
  fs.writeFileSync(STATUS_FILE, JSON.stringify(updated, null, 2));
}

/**
 * Append a log line to the deploy status.
 * If the last log was overwritable and this one replaces it, replace it.
 */
export function appendLog(text: string, overwritable = false): void {
  const status = getDeployStatus();
  const logs = status.logs ?? [];

  // If last log was overwritable and new one is too, replace it (npm progress behavior)
  if (logs.length > 0 && logs[logs.length - 1].overwritable && overwritable) {
    logs[logs.length - 1] = { text, overwritable };
  } else {
    // If last log was overwritable but new one isn't, finalize the old one
    if (logs.length > 0 && logs[logs.length - 1].overwritable) {
      logs[logs.length - 1].overwritable = false;
    }
    logs.push({ text, overwritable });
  }

  setDeployStatus({ logs });
}

/**
 * Clear all logs from the deploy status.
 */
export function clearLogs(): void {
  setDeployStatus({ logs: [] });
}
