import { Router } from "express";
import db from "../db/db.js";

const router = Router();

// Get a setting by key
router.get("/:key", (req, res) => {
  try {
    const { key } = req.params;
    const row = db
      .prepare("SELECT value FROM settings WHERE key = ?")
      .get(key) as { value: string } | undefined;

    // Default values
    if (!row && key === "enable_tracing") {
      return res.json({ value: "false" });
    }

    res.json({ value: row ? row.value : null });
  } catch (err: any) {
    console.error("Failed to get setting:", err);
    res.status(500).json({ error: "Failed to get setting" });
  }
});

// Update a setting
router.put("/:key", (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;

    if (value === undefined) {
      return res.status(400).json({ error: "Missing value" });
    }

    db.prepare(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    ).run(key, String(value));

    res.json({ success: true, key, value });
  } catch (err: any) {
    console.error("Failed to update setting:", err);
    res.status(500).json({ error: "Failed to update setting" });
  }
});

export default router;
