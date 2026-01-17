import { Router } from "express";
import db from "../db/db.js";
import { Broadcast, Contact } from "../../shared/types.js";
import { createBroadcastSchema } from "../validations/broadcastSchemas.js";
import { whatsappService } from "../services/whatsapp.js";

const router = Router();

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
router.post("/", async (req, res) => {
  const validation = createBroadcastSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({ error: validation.error.issues[0].message });
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

  // Logic for status:
  // If recurring => 'scheduled' (and nextRun = scheduledTime)
  // If once => 'scheduled' if scheduledTime is set
  // If instant => 'processing' (or handled immediately, but sticking to 'draft'/'scheduled' logic for now)
  // BUT existing code says: scheduledTime ? "scheduled" : "draft"

  let status = scheduledTime ? "scheduled" : "draft";
  const broadcastType = type || (scheduledTime ? "once" : "instant");

  // If recurring, we might want to ensure status is 'scheduled'
  if (broadcastType === "recurring") {
    status = "scheduled";
  } else if (broadcastType === "instant") {
    status = "processing";
  }

  try {
    const trans = db.transaction(() => {
      const stmt = db.prepare(
        "INSERT INTO broadcasts (name, message, scheduledTime, status, type, intervalValue, intervalUnit, nextRun) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      );
      // For recurring, nextRun is initially the scheduledTime
      const nextRun = broadcastType === "recurring" ? scheduledTime : null;

      const info = stmt.run(
        name,
        message,
        scheduledTime || null,
        status,
        broadcastType,
        intervalValue || null,
        intervalUnit || null,
        nextRun
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
      // Run asynchronously to not block response?
      // User said "just like schedules" which awaits. Schedules handles 1 msg.
      // Broadcast can be many. If we await, it might timeout.
      // BUT, sending unsaved opens/closes browser. Doing this in loop is VERY SLOW.
      // We will attempt to send one by one.

      // Fetch contacts
      const placeholders = contactIds.map(() => "?").join(",");
      const contacts = db
        .prepare(`SELECT * FROM contacts WHERE id IN (${placeholders})`)
        .all(...contactIds) as Contact[];

      console.log(
        `Processing instant broadcast ${id} for ${contacts.length} contacts...`
      );

      // We'll process this in background so we can return response?
      // schedules.ts awaits. But schedules creates 1 task.
      // If I await here, 10 contacts * 10 seconds = 100 seconds timeout.
      // I will process in background, but log errors.

      (async () => {
        for (const contact of contacts) {
          try {
            await whatsappService.sendMessageUnsaved(contact.number, message);
            // Update recipient status
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
        // Update broadcast status to completed
        db.prepare(
          "UPDATE broadcasts SET status = 'completed' WHERE id = ?"
        ).run(id);
      })();
    }

    res.status(201).json(newBroadcast);
  } catch (err: any) {
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
