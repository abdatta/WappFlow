import { Router } from "express";
import db from "../db/db.js";
import { CreateScheduleDto, Schedule } from "../../shared/types.js";

import { createScheduleSchema } from "../validations/scheduleSchemas.js";

const router = Router();

// GET all schedules
router.get("/", (req, res) => {
  const stmt = db.prepare("SELECT * FROM schedules ORDER BY createdAt DESC");
  const schedules = stmt.all() as Schedule[];
  res.json(schedules);
});

// POST create schedule
router.post("/", (req, res) => {
  const validation = createScheduleSchema.safeParse(req.body);

  if (!validation.success) {
    return res.status(400).json({ error: validation.error.issues[0].message });
  }

  const body = validation.data;

  try {
    // If it's a recurring schedule with interval, map scheduleTime to nextRun
    let nextRun = undefined;
    if (body.type === "recurring" && body.intervalValue) {
      nextRun = body.scheduleTime; // The start time is the first 'nextRun'
    }

    const stmt = db.prepare(`
      INSERT INTO schedules (type, phoneNumber, message, scheduleTime, cronExpression, intervalValue, intervalUnit, toleranceMinutes, nextRun, status)
      VALUES (@type, @phoneNumber, @message, @scheduleTime, @cronExpression, @intervalValue, @intervalUnit, @toleranceMinutes, @nextRun, 'active')
    `);

    const params = {
      type: body.type,
      phoneNumber: body.phoneNumber,
      message: body.message,
      scheduleTime: body.scheduleTime || null,
      cronExpression: body.cronExpression || null,
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
    res.status(500).json({ error: err.message });
  }
});

// DELETE schedule
router.delete("/:id", (req, res) => {
  const { id } = req.params;
  const stmt = db.prepare("DELETE FROM schedules WHERE id = ?");
  const info = stmt.run(id);

  if (info.changes === 0) {
    return res.status(404).json({ error: "Schedule not found" });
  }

  res.json({ success: true });
});

export default router;
