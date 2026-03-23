import { Router } from "express";
import { isAuthenticated, isAdmin } from "../middleware/auth";
import pool from "../config/db";

const router = Router();

// Get templates for a location
router.get("/location/:locationId", isAuthenticated, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM templates WHERE location_id = $1 ORDER BY times_used DESC",
      [req.params.locationId]
    );
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create template
router.post("/", isAuthenticated, async (req, res) => {
  try {
    const { location_id, name, category, body_text } = req.body;
    const result = await pool.query(
      `INSERT INTO templates (location_id, name, category, body_text)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [location_id, name, category, body_text]
    );
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update template
router.put("/:id", isAuthenticated, async (req, res) => {
  try {
    const { name, category, body_text } = req.body;
    const result = await pool.query(
      `UPDATE templates SET name = $1, category = $2, body_text = $3 WHERE id = $4 RETURNING *`,
      [name, category, body_text, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete template
router.delete("/:id", isAuthenticated, async (req, res) => {
  try {
    await pool.query("DELETE FROM templates WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Apply template (increment usage count)
router.post("/:id/apply", isAuthenticated, async (req, res) => {
  try {
    const { reviewer_name, business_name } = req.body;
    const template = await pool.query("SELECT * FROM templates WHERE id = $1", [req.params.id]);
    if (template.rows.length === 0) {
      return res.status(404).json({ error: "Template not found" });
    }

    let text = template.rows[0].body_text;
    const now = new Date();
    text = text
      .replace(/{reviewer_name}/g, reviewer_name || "")
      .replace(/{business_name}/g, business_name || "")
      .replace(/{month}/g, now.toLocaleString("fr-FR", { month: "long" }))
      .replace(/{year}/g, now.getFullYear().toString());

    await pool.query("UPDATE templates SET times_used = times_used + 1 WHERE id = $1", [req.params.id]);

    res.json({ text });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: push template to multiple locations
router.post("/:id/push", isAdmin, async (req, res) => {
  try {
    const { location_ids } = req.body;
    const template = await pool.query("SELECT * FROM templates WHERE id = $1", [req.params.id]);
    if (template.rows.length === 0) {
      return res.status(404).json({ error: "Template not found" });
    }

    const t = template.rows[0];
    for (const locId of location_ids) {
      await pool.query(
        `INSERT INTO templates (location_id, name, category, body_text)
         VALUES ($1, $2, $3, $4)`,
        [locId, t.name, t.category, t.body_text]
      );
    }

    res.json({ success: true, pushed_to: location_ids.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
