import { Router } from "express";
import db from "../db/db.js";
import { Contact } from "../../shared/types.js";
import { createContactSchema } from "../validations/contactSchemas.js";

const router = Router();

// GET all contacts
router.get("/", (req, res) => {
  try {
    const stmt = db.prepare("SELECT * FROM contacts ORDER BY name ASC");
    const contacts = stmt.all() as Contact[];
    res.json(contacts);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST create contact
router.post("/", (req, res) => {
  const validation = createContactSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({ error: validation.error.issues[0].message });
  }
  const { name, number, email, companyName } = validation.data;

  try {
    const stmt = db.prepare(
      "INSERT INTO contacts (name, number, email, companyName) VALUES (?, ?, ?, ?)"
    );
    const info = stmt.run(name, number, email || null, companyName || null);
    const newContact = db
      .prepare("SELECT * FROM contacts WHERE id = ?")
      .get(info.lastInsertRowid);
    res.status(201).json(newContact);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST bulk create contacts
router.post("/bulk", (req, res) => {
  const contacts = req.body;
  if (!Array.isArray(contacts)) {
    return res
      .status(400)
      .json({ error: "Input must be an array of contacts" });
  }

  try {
    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
    };

    const stmt = db.prepare(
      "INSERT INTO contacts (name, number, email, companyName) VALUES (?, ?, ?, ?)"
    );

    const transaction = db.transaction((data: any[]) => {
      for (const contact of data) {
        const validation = createContactSchema.safeParse(contact);
        if (validation.success) {
          try {
            const { name, number, email, companyName } = validation.data;
            stmt.run(name, number, email || null, companyName || null);
            results.success++;
          } catch (e: any) {
            results.failed++;
            results.errors.push(`Row error: ${e.message}`);
          }
        } else {
          results.failed++;
          results.errors.push(
            `Validation error for ${contact.name || "unknown"}: ${
              validation.error.issues[0].message
            }`
          );
        }
      }
    });

    transaction(contacts);
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE contact
router.delete("/:id", (req, res) => {
  const { id } = req.params;
  try {
    const stmt = db.prepare("DELETE FROM contacts WHERE id = ?");
    const info = stmt.run(id);
    if (info.changes === 0) {
      return res.status(404).json({ error: "Contact not found" });
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
