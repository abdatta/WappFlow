/**
 * Shared deployment status utilities
 *
 * Used by both the deploy API endpoint and the update script.
 */

import fs from "fs";
import path from "path";

export const STATUS_FILE = path.resolve("data/deploy-status.json");

export interface DeployStatus {
  status: "idle" | "running" | "success" | "failed";
  startedAt?: string;
  completedAt?: string;
  error?: string;
  step?: string;
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
