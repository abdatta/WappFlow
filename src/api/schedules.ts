import { Router } from "express";
import { Schedule } from "../../shared/types.js";
import db from "../db/db.js";

import { createScheduleSchema } from "../validations/scheduleSchemas.js";

import { whatsappService } from "../services/whatsapp.js";
import { schedulerService } from "../services/scheduler.js";

const router = Router();

// GET all schedules
router.get("/", (req, res) => {
  const stmt = db.prepare("SELECT * FROM schedules ORDER BY createdAt DESC");
  const schedules = stmt.all() as Schedule[];
  res.json(schedules);
});

// POST create schedule
router.post("/", async (req, res) => {
  const validation = createScheduleSchema.safeParse(req.body);

  if (!validation.success) {
    return res.status(400).json({ error: validation.error.issues[0].message });
  }

  const body = validation.data;

  try {
    // Direct send for 'instant' messages
    if (body.type === "instant") {
      console.log("Processing instant message request...");
      await whatsappService.sendMessage(body.contactName, body.message);
      // We don't save to DB as per requirement
      // But we should probably return something that looks successful
      return res.status(200).json({ success: true, message: "Message sent" });
    }

    // If it's a recurring schedule with interval, map scheduleTime to nextRun
    let nextRun = undefined;
    if (body.type === "recurring" && body.intervalValue) {
      nextRun = body.scheduleTime; // The start time is the first 'nextRun'
    }

    const stmt = db.prepare(`
      INSERT INTO schedules (type, contactName, message, scheduleTime, intervalValue, intervalUnit, toleranceMinutes, nextRun, status)
      VALUES (@type, @contactName, @message, @scheduleTime, @intervalValue, @intervalUnit, @toleranceMinutes, @nextRun, 'active')
    `);

    const params = {
      type: body.type,
      contactName: body.contactName,
      message: body.message,
      scheduleTime: body.scheduleTime || null,
      intervalValue: body.intervalValue || null,
      intervalUnit: body.intervalUnit || null,
      toleranceMinutes: body.toleranceMinutes || null,
      nextRun: nextRun || null,
    };

    const info = stmt.run(params);
    const newSchedule = db
      .prepare("SELECT * FROM schedules WHERE id = ?")
      .get(info.lastInsertRowid);

    res.status(201).json(newSchedule);
  } catch (err: any) {
    console.error("Error processing schedule request:", err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE schedule
router.delete("/:id", (req, res) => {
  const { id } = req.params;
  const stmt = db.prepare("DELETE FROM schedules WHERE id = ?");
  const info = stmt.run(id);

  if (info.changes === 0) {
    console.warn(`Failed to delete schedule ${id}: Not found`);
    return res.status(404).json({ error: "Schedule not found" });
  }

  console.log(`Deleted schedule ${id}`);
  res.json({ success: true });
});

// PATCH update status (access: pause/resume)
router.patch("/:id/status", (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (status !== "active" && status !== "paused") {
    return res
      .status(400)
      .json({ error: "Invalid status. Use 'active' or 'paused'." });
  }

  try {
    if (status === "paused") {
      schedulerService.pauseSchedule(Number(id));
    } else if (status === "active") {
      schedulerService.resumeSchedule(Number(id));
    }
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }

  res.json({ success: true, status });
});

// PUT update schedule
router.put("/:id", (req, res) => {
  const { id } = req.params;
  const {
    type,
    contactName,
    message,
    scheduleTime,
    intervalValue,
    intervalUnit,
    toleranceMinutes,
  } = req.body;

  // Validate type
  if (type && type !== "once" && type !== "recurring") {
    return res
      .status(400)
      .json({ error: "Invalid type. Use 'once' or 'recurring'." });
  }

  try {
    // Check if schedule exists
    const existing = db
      .prepare("SELECT * FROM schedules WHERE id = ?")
      .get(id) as Schedule | undefined;
    if (!existing) {
      return res.status(404).json({ error: "Schedule not found" });
    }

    // Build update
    const newType = type || existing.type;
    const newContactName = contactName || existing.contactName;
    const newMessage = message || existing.message;

    let newScheduleTime =
      scheduleTime !== undefined ? scheduleTime : existing.scheduleTime;
    let newIntervalValue =
      intervalValue !== undefined ? intervalValue : existing.intervalValue;
    let newIntervalUnit =
      intervalUnit !== undefined ? intervalUnit : existing.intervalUnit;
    let newToleranceMinutes =
      toleranceMinutes !== undefined
        ? toleranceMinutes
        : existing.toleranceMinutes;
    let newNextRun = existing.nextRun;

    // If changing to recurring, set nextRun from scheduleTime
    if (newType === "recurring" && newIntervalValue) {
      newNextRun = newScheduleTime;
    } else if (newType === "once") {
      // Clear interval fields for 'once' type
      newIntervalValue = undefined;
      newIntervalUnit = undefined;
      newToleranceMinutes = undefined;
      newNextRun = undefined;
    }

    const stmt = db.prepare(`
      UPDATE schedules SET
        type = @type,
        contactName = @contactName,
        message = @message,
        scheduleTime = @scheduleTime,
        intervalValue = @intervalValue,
        intervalUnit = @intervalUnit,
        toleranceMinutes = @toleranceMinutes,
        nextRun = @nextRun
      WHERE id = @id
    `);

    stmt.run({
      id,
      type: newType,
      contactName: newContactName,
      message: newMessage,
      scheduleTime: newScheduleTime,
      intervalValue: newIntervalValue,
      intervalUnit: newIntervalUnit,
      toleranceMinutes: newToleranceMinutes,
      nextRun: newNextRun,
    });

    const updated = db.prepare("SELECT * FROM schedules WHERE id = ?").get(id);
    res.json(updated);
  } catch (err: any) {
    console.error("Error updating schedule:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
