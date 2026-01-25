/**
 * Deployment Update Script with Rollback Protection
 *
 * This script is spawned by the deploy API endpoint and runs as a detached process.
 * It performs the following steps:
 * 1. Update status to "running"
 * 2. Backup the current dist folder
 * 3. Pull latest code from git
 * 4. Install dependencies
 * 5. Build the project
 * 6. Restart the app via PM2
 * 7. Update status to "success" or rollback on failure
 *
 * This script is cross-platform (Windows/Linux compatible).
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { setDeployStatus } from "./status.js";

const DIST_DIR = path.resolve("dist");
const BACKUP_DIR = path.resolve("dist.backup");

function log(message: string): void {
  const timestamp = new Date().toISOString();
  console.log(`${timestamp} [Deploy] ${message}`);
}

function updateStatus(step: string): void {
  setDeployStatus({ step });
  log(`Status updated: ${step}`);
}

function exec(command: string, description: string): void {
  updateStatus(description);
  log(`${description}...`);
  try {
    execSync(command, {
      stdio: "inherit",
      cwd: process.cwd(),
    });
    log(`${description} completed`);
  } catch (error) {
    log(`${description} FAILED`);
    throw error;
  }
}

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

async function main(): Promise<void> {
  log("Starting deployment update");
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
    exec("git pull origin main", "Pulling latest code");

    // Step 3: Install dependencies
    exec("npm ci", "Installing dependencies");

    // Step 4: Build the project
    exec("npm run build", "Building project");

    // Step 5: Restart via PM2
    exec("npx pm2 restart wapp-flow", "Restarting application");

    // Success! Clean up backup
    cleanupBackup();

    setDeployStatus({
      status: "success",
      completedAt: new Date().toISOString(),
      step: "Deployment complete",
    });

    log("Deployment update completed successfully!");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`Deployment failed: ${errorMessage}`);

    // Attempt rollback
    const restored = restoreBackup();
    if (restored) {
      log("Attempting to restart with restored backup...");
      try {
        execSync("npx pm2 restart wapp-flow", {
          stdio: "inherit",
          cwd: process.cwd(),
        });
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
