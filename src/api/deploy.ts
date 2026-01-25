import { spawn } from "child_process";
import { Router } from "express";
import path from "path";
import { getDeployStatus, setDeployStatus } from "../deploy/status.js";

const router = Router();

/**
 * GET /api/deploy/status
 * Returns the current deployment status.
 */
router.get("/status", (req, res) => {
  const status = getDeployStatus();
  res.json(status);
});

/**
 * POST /api/deploy
 * Triggers a deployment update. Requires X-Deploy-Token header.
 * Returns immediately and runs the update script in the background.
 */
router.post("/", (req, res) => {
  const token = req.headers["x-deploy-token"];
  const expectedToken = process.env.DEPLOY_TOKEN;

  // Validate token
  if (!expectedToken) {
    console.error("Deploy: DEPLOY_TOKEN environment variable not set");
    return res.status(500).json({ error: "Deployment not configured" });
  }

  if (!token || token !== expectedToken) {
    console.warn("Deploy: Invalid or missing token");
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Check if deployment is already running
  const currentStatus = getDeployStatus();
  if (currentStatus.status === "running") {
    console.warn("Deploy: Deployment already in progress");
    return res.status(409).json({
      error: "Deployment already in progress",
      status: currentStatus,
    });
  }

  console.log("Deploy: Valid deploy request received, triggering update...");

  // Set initial status
  setDeployStatus({
    status: "running",
    startedAt: new Date().toISOString(),
    error: undefined,
    completedAt: undefined,
    step: "Starting deployment",
  });

  // Spawn the update script as a detached process
  const updateScript = path.resolve("dist/src/deploy/update.js");

  const child = spawn(process.execPath, [updateScript], {
    detached: true,
    stdio: "ignore",
    cwd: process.cwd(),
    env: { ...process.env },
  });

  child.unref();

  console.log(`Deploy: Update script spawned with PID ${child.pid}`);

  res.status(202).json({
    message: "Deployment triggered",
    pid: child.pid,
  });
});

export default router;
