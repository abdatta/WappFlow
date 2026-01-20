import { Router } from "express";
import db from "../db/db.js";
import { Broadcast, Contact } from "../../shared/types.js";
import { createBroadcastSchema } from "../validations/broadcastSchemas.js";
import { whatsappService } from "../services/whatsapp.js";
import multer from "multer";
import path from "path";
import fs from "fs";

const router = Router();

// Setup multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.resolve("data/uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({ storage });

// GET all broadcasts
router.get("/", (req, res) => {
  try {
    const stmt = db.prepare("SELECT * FROM broadcasts ORDER BY createdAt DESC");
    const broadcasts = stmt.all() as Broadcast[];
    res.json(broadcasts);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET broadcast details
router.get("/:id", (req, res) => {
  const { id } = req.params;
  try {
    const broadcast = db
      .prepare("SELECT * FROM broadcasts WHERE id = ?")
      .get(id) as Broadcast;
    if (!broadcast) {
      return res.status(404).json({ error: "Broadcast not found" });
    }

    const recipients = db
      .prepare(
        `
        SELECT br.*, c.name as contactName, c.number as contactNumber 
        FROM broadcast_recipients br
        JOIN contacts c ON br.contactId = c.id
        WHERE br.broadcastId = ?
     `
      )
      .all(id);

    res.json({ ...broadcast, recipients });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST create broadcast
router.post("/", upload.single("attachment"), async (req, res) => {
  try {
    // If contactIds is coming as a string (from FormData), parse it
    if (typeof req.body.contactIds === "string") {
      try {
        req.body.contactIds = JSON.parse(req.body.contactIds);
      } catch (e) {
        // Fallback or ignore
      }
    }
    // Convert numerical strings
    if (req.body.intervalValue) {
      req.body.intervalValue = parseInt(req.body.intervalValue);
    }

    const validation = createBroadcastSchema.safeParse(req.body);
    if (!validation.success) {
      return res
        .status(400)
        .json({ error: validation.error.issues[0].message });
    }
    const {
      name,
      message,
      contactIds,
      scheduledTime,
      type,
      intervalValue,
      intervalUnit,
    } = validation.data;

    const attachmentPath = req.file ? req.file.path : null;
    const attachmentName = req.file ? req.file.originalname : null;

    let status = scheduledTime ? "scheduled" : "draft";
    const broadcastType = type || (scheduledTime ? "once" : "instant");

    if (broadcastType === "recurring") {
      status = "scheduled";
    } else if (broadcastType === "instant") {
      status = "processing";
    }

    const trans = db.transaction(() => {
      const stmt = db.prepare(
        "INSERT INTO broadcasts (name, message, scheduledTime, status, type, intervalValue, intervalUnit, nextRun, attachmentPath, attachmentName) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      );
      const nextRun = broadcastType === "recurring" ? scheduledTime : null;

      const info = stmt.run(
        name,
        message,
        scheduledTime || null,
        status,
        broadcastType,
        intervalValue || null,
        intervalUnit || null,
        nextRun,
        attachmentPath,
        attachmentName
      );
      const broadcastId = info.lastInsertRowid;

      const recipientStmt = db.prepare(
        "INSERT INTO broadcast_recipients (broadcastId, contactId) VALUES (?, ?)"
      );
      for (const cid of contactIds) {
        recipientStmt.run(broadcastId, cid);
      }
      return broadcastId;
    });

    const id = trans();
    const newBroadcast = db
      .prepare("SELECT * FROM broadcasts WHERE id = ?")
      .get(id);

    // Send immediately if instant
    if (broadcastType === "instant") {
      const placeholders = contactIds.map(() => "?").join(",");
      const contacts = db
        .prepare(`SELECT * FROM contacts WHERE id IN (${placeholders})`)
        .all(...contactIds) as Contact[];

      console.log(
        `Processing instant broadcast ${id} for ${contacts.length} contacts...`
      );

      (async () => {
        for (const contact of contacts) {
          try {
            await whatsappService.sendMessageUnsaved(
              contact.number,
              message,
              attachmentPath || undefined,
              attachmentName || undefined
            );
            db.prepare(
              "UPDATE broadcast_recipients SET status = 'sent', sentAt = CURRENT_TIMESTAMP WHERE broadcastId = ? AND contactId = ?"
            ).run(id, contact.id);
          } catch (err: any) {
            console.error(
              `Failed to send broadcast ${id} to ${contact.number}:`,
              err
            );
            db.prepare(
              "UPDATE broadcast_recipients SET status = 'failed', error = ? WHERE broadcastId = ? AND contactId = ?"
            ).run(err.message, id, contact.id);
          }
        }
        db.prepare(
          "UPDATE broadcasts SET status = 'completed' WHERE id = ?"
        ).run(id);
      })();
    }

    res.status(201).json(newBroadcast);
  } catch (err: any) {
    console.error("Broadcast creation error:", err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE broadcast
router.delete("/:id", (req, res) => {
  const { id } = req.params;
  try {
    const stmt = db.prepare("DELETE FROM broadcasts WHERE id = ?");
    const info = stmt.run(id);
    if (info.changes === 0) {
      return res.status(404).json({ error: "Broadcast not found" });
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
