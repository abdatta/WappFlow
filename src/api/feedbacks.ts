import { Router } from "express";
import {
  CreateFeedbackDto,
  Feedback,
  UpdateFeedbackDto,
} from "../../shared/types.js";
import db from "../db/db.js";

const router = Router();

// GET /api/feedbacks
router.get("/", (req, res) => {
  try {
    const feedbacks = db
      .prepare("SELECT * FROM feedbacks ORDER BY createdAt DESC")
      .all()
      .map((row: any) => ({
        ...row,
        isAddressed: !!row.isAddressed,
      }));
    res.json(feedbacks);
  } catch (error) {
    console.error("Error fetching feedbacks:", error);
    res.status(500).json({ error: "Failed to fetch feedbacks" });
  }
});

// POST /api/feedbacks
router.post("/", (req, res) => {
  try {
    const { content } = req.body as CreateFeedbackDto;

    if (!content) {
      return res.status(400).json({ error: "Content is required" });
    }

    const result = db
      .prepare("INSERT INTO feedbacks (content) VALUES (?)")
      .run(content);

    const newFeedback: Feedback = {
      id: result.lastInsertRowid as number,
      content,
      isAddressed: false,
      createdAt: new Date().toISOString(),
    };

    res.status(201).json(newFeedback);
  } catch (error) {
    console.error("Error creating feedback:", error);
    res.status(500).json({ error: "Failed to create feedback" });
  }
});

// PUT /api/feedbacks/:id
router.put("/:id", (req, res) => {
  try {
    const { id } = req.params;
    const { content, isAddressed } = req.body as UpdateFeedbackDto;

    const updates: string[] = [];
    const values: any[] = [];

    if (content !== undefined) {
      updates.push("content = ?");
      values.push(content);
    }

    if (isAddressed !== undefined) {
      updates.push("isAddressed = ?");
      values.push(isAddressed ? 1 : 0);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    values.push(id);

    const result = db
      .prepare(`UPDATE feedbacks SET ${updates.join(", ")} WHERE id = ?`)
      .run(...values);

    if (result.changes === 0) {
      return res.status(404).json({ error: "Feedback not found" });
    }

    // Return updated feedback
    const updatedFeedback = db
      .prepare("SELECT * FROM feedbacks WHERE id = ?")
      .get(id) as any;

    if (updatedFeedback) {
      updatedFeedback.isAddressed = !!updatedFeedback.isAddressed;
    }

    res.json(updatedFeedback);
  } catch (error) {
    console.error("Error updating feedback:", error);
    res.status(500).json({ error: "Failed to update feedback" });
  }
});

// DELETE /api/feedbacks/:id
router.delete("/:id", (req, res) => {
  try {
    const { id } = req.params;
    const result = db.prepare("DELETE FROM feedbacks WHERE id = ?").run(id);

    if (result.changes === 0) {
      return res.status(404).json({ error: "Feedback not found" });
    }

    res.json({ message: "Feedback deleted successfully" });
  } catch (error) {
    console.error("Error deleting feedback:", error);
    res.status(500).json({ error: "Failed to delete feedback" });
  }
});

export default router;
