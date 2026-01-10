import { Router } from "express";
import db from "../db/db.js";
import { CreateScheduleDto, Schedule } from "../../shared/types.js";

const router = Router();

// GET all schedules
router.get("/", (req, res) => {
  const stmt = db.prepare("SELECT * FROM schedules ORDER BY createdAt DESC");
  const schedules = stmt.all() as Schedule[];
  res.json(schedules);
});

// POST create schedule
router.post("/", (req, res) => {
  const body = req.body as CreateScheduleDto;

  // Basic validation
  if (!body.phoneNumber || !body.message || !body.type) {
    return res.status(400).json({ error: "Missing required fields" });
  }

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

    const info = stmt.run({ ...body, nextRun });
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
