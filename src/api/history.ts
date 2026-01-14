import { Router } from "express";
import fs from "fs";
import path from "path";
import db from "../db/db.js";

const router = Router();

router.get("/", (req, res) => {
  try {
    const logs = db
      .prepare(
        "SELECT id, scheduleId, type, contactName, message, status, error, (CAST(strftime('%s', timestamp) AS INTEGER) * 1000) as timestamp FROM message_logs ORDER BY id DESC"
      )
      .all() as any[];

    // Check for trace files
    const logsWithTrace = logs.map((log) => {
      const tracePath = path.resolve(`data/traces/trace_${log.id}.zip`);
      return {
        ...log,
        hasTrace: fs.existsSync(tracePath),
      };
    });

    res.json(logsWithTrace);
  } catch (err: any) {
    console.error("Failed to fetch history:", err);
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

router.get("/suggestions", (req, res) => {
  try {
    const contacts = db
      .prepare(
        "SELECT DISTINCT contactName FROM message_logs WHERE status = 'sent' ORDER BY contactName ASC"
      )
      .all() as { contactName: string }[];

    // Return simple array of strings
    res.json(contacts.map((c) => c.contactName));
  } catch (err: any) {
    console.error("Failed to fetch suggestions:", err);
    // Return empty array on error instead of failing, to not break UI
    res.json([]);
  }
});

router.get("/:id/trace", (req, res) => {
  const { id } = req.params;
  const tracePath = path.resolve(`data/traces/trace_${id}.zip`);

  if (fs.existsSync(tracePath)) {
    res.download(tracePath, `trace_${id}.zip`);
  } else {
    res.status(404).json({ error: "Trace not found" });
  }
});

export default router;
