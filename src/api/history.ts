import { Router } from "express";
import db from "../db/db.js";

const router = Router();

router.get("/", (req, res) => {
  try {
    const logs = db
      .prepare(
        "SELECT id, scheduleId, type, contactName, message, status, error, (CAST(strftime('%s', timestamp) AS INTEGER) * 1000) as timestamp FROM message_logs ORDER BY id DESC",
      )
      .all();
    res.json(logs);
  } catch (err: any) {
    console.error("Failed to fetch history:", err);
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

export default router;
