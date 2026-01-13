import { Router } from "express";
import db from "../db/db.js";
import { whatsappService } from "../services/whatsapp.js";

const router = Router();

router.get("/status", (req, res) => {
  res.json(whatsappService.getStatus());
});

router.post("/send", async (req, res) => {
  const { contactName, message } = req.body;

  if (!contactName || !message) {
    return res.status(400).json({ error: "Missing contactName or message" });
  }

  // Create 'sending' log
  const info = db
    .prepare(
      "INSERT INTO message_logs (type, contactName, message, status) VALUES (?, ?, ?, ?)",
    )
    .run("instant", contactName, message, "sending");

  const logId = info.lastInsertRowid;

  try {
    await whatsappService.sendMessage(contactName, message, logId);

    // Update to 'sent'
    db.prepare("UPDATE message_logs SET status = 'sent' WHERE id = ?").run(
      logId,
    );

    res.json({ success: true, logId });
  } catch (err: any) {
    console.error("Instant message failed:", err);

    // Update to 'failed'
    db.prepare(
      "UPDATE message_logs SET status = 'failed', error = ? WHERE id = ?",
    ).run(err.message, logId);

    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
