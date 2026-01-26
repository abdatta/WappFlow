/**
 * Deployment Update Script with Rollback Protection and Live Logging
 *
 * This script is spawned by the deploy API endpoint and runs as a detached process.
 * It performs the following steps:
 * 1. Update status to "running"
 * 2. Backup the current dist folder
 * 3. Pull latest code from git
 * 4. Install dependencies (with live progress)
 * 5. Build the project
 * 6. Restart the app via PM2
 * 7. Update status to "success" or rollback on failure
 *
 * Logs are streamed in real-time to the status file for polling.
 * This script is cross-platform (Windows/Linux compatible).
 */

import { spawn, SpawnOptions } from "child_process";
import fs from "fs";
import path from "path";
import { clearLogs, setDeployStatus } from "./status.js";
import { exec, log, updateStatus } from "./utils.js";

const DIST_DIR = path.resolve("dist");
const BACKUP_DIR = path.resolve("dist.backup");

// ==========================================
// Main Execution
// ==========================================

async function main(): Promise<void> {
  // Prevent the process from closing on typical signals (like when parent exits)
  const signals = ["SIGINT", "SIGTERM", "SIGHUP"];
  signals.forEach((signal) => {
    process.on(signal, () => {
      console.log(`Received ${signal}, ignoring to continue deployment...`);
    });
  });

  log("Starting deployment update");
  clearLogs();
  setDeployStatus({
    status: "running",
    startedAt: new Date().toISOString(),
    error: undefined,
    completedAt: undefined,
  });

  // Wait a moment to ensure the HTTP response was sent
  await new Promise((resolve) => setTimeout(resolve, 2000));

  try {
    // Step 1: Backup current dist
    backupDist();

    // Step 2: Pull latest code
    await pullLatestCode();

    // Step 3: Install dependencies
    await installDependencies();

    // Step 4: Build the project
    await buildProject();

    // Step 5: Restart via PM2
    await restartApp();

    // Success! Clean up backup
    cleanupBackup();

    setDeployStatus({
      status: "success",
      completedAt: new Date().toISOString(),
      step: "Deployment complete",
    });

    log("Deployment update completed successfully!");
    process.exit(0);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`Deployment failed: ${errorMessage}`);

    // Attempt rollback
    const restored = restoreBackup();
    if (restored) {
      log("Attempting to restart with restored backup...");
      try {
        await rollbackApp();
        log("Rollback successful, app restarted with previous version");
      } catch {
        log("Failed to restart after rollback");
      }
    }

    setDeployStatus({
      status: "failed",
      completedAt: new Date().toISOString(),
      error:
        errorMessage + (restored ? " (rolled back to previous version)" : ""),
      step: "Deployment failed",
    });

    process.exit(1);
  }
}

main();

// ==========================================
// Deployment Steps
// ==========================================

function backupDist(): void {
  updateStatus("Creating backup");
  if (fs.existsSync(DIST_DIR)) {
    log("Creating backup of dist folder...");
    // Remove old backup if exists
    if (fs.existsSync(BACKUP_DIR)) {
      fs.rmSync(BACKUP_DIR, { recursive: true });
    }
    // Copy dist to backup
    fs.cpSync(DIST_DIR, BACKUP_DIR, { recursive: true });
    log("Backup created successfully");
  } else {
    log("No dist folder to backup (first deploy)");
  }
}

function restoreBackup(): boolean {
  if (fs.existsSync(BACKUP_DIR)) {
    log("Restoring backup...");
    try {
      // Remove broken dist
      if (fs.existsSync(DIST_DIR)) {
        fs.rmSync(DIST_DIR, { recursive: true });
      }
      // Restore from backup
      fs.cpSync(BACKUP_DIR, DIST_DIR, { recursive: true });
      log("Backup restored successfully");
      return true;
    } catch (error) {
      log(`Failed to restore backup: ${error}`);
      return false;
    }
  }
  log("No backup available to restore");
  return false;
}

function cleanupBackup(): void {
  updateStatus("Cleaning up backup");
  if (fs.existsSync(BACKUP_DIR)) {
    log("Cleaning up backup...");
    fs.rmSync(BACKUP_DIR, { recursive: true });
    log("Backup cleaned up");
  }
}

async function pullLatestCode(): Promise<void> {
  await exec("git", ["checkout", "--", "."], "Discarding local changes");
  await exec("git", ["pull", "origin", "main"], "Pulling latest code");
}

async function installDependencies(): Promise<void> {
  // Force NODE_ENV to development to ensure devDependencies (like husky) are installed
  await exec("npm", ["install"], "Installing dependencies", {
    NODE_ENV: "development",
  });
}

async function buildProject(): Promise<void> {
  await exec("npm", ["run", "build"], "Building project");
}

async function restartApp(): Promise<void> {
  await exec("npx", ["pm2", "restart", "wapp-flow"], "Restarting application");
}

async function rollbackApp(): Promise<void> {
  await exec("npx", ["pm2", "restart", "wapp-flow"], "Rolling back");
}
