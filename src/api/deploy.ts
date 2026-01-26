import { spawn } from "child_process";
import { Router } from "express";
import path from "path";
import { getDeployStatus, setDeployStatus } from "../deploy/status.js";
import { spawnDetachedScript } from "../deploy/utils.js";

const router = Router();

/**
 * GET /api/deploy/status
 * Returns the current deployment status.
 * Optionally pass ?fromLogIndex=N to get only logs starting from index N.
 */
router.get("/status", (req, res) => {
  const status = getDeployStatus();
  const fromLogIndex = parseInt(req.query.fromLogIndex as string, 10);

  // If fromLogIndex is provided, slice logs to only return new ones
  if (!isNaN(fromLogIndex) && status.logs) {
    res.json({
      ...status,
      logs: status.logs.slice(fromLogIndex),
      totalLogCount: status.logs.length,
    });
  } else {
    res.json({
      ...status,
      totalLogCount: status.logs?.length ?? 0,
    });
  }
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
  // Spawn the update script as a detached process
  const updateScript = path.resolve("src/deploy/update.ts");

  try {
    const child = spawnDetachedScript(updateScript);
    console.log(`Deploy: Update script spawned with PID ${child.pid}`);

    res.status(202).json({
      message: "Deployment triggered",
      pid: child.pid,
    });
  } catch (error) {
    console.error("Deploy: Failed to spawn update script:", error);
    res.status(500).json({ error: "Failed to start deployment" });
  }
});

export default router;
