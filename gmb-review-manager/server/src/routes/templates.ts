import { Router } from "express";
import { isAuthenticated, isAdmin, ownsLocation } from "../middleware/auth";
import pool from "../config/db";

const router = Router();

// Get templates for a location
router.get("/location/:locationId", isAuthenticated, ownsLocation, async (req, res) => {
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

    // Validate required fields
    if (!location_id || !name || !category || !body_text) {
      return res.status(400).json({ error: "location_id, name, category, and body_text are required" });
    }
    if (typeof name !== "string" || name.trim().length === 0 || name.length > 255) {
      return res.status(400).json({ error: "Name must be 1-255 characters" });
    }
    if (typeof body_text !== "string" || body_text.trim().length === 0 || body_text.length > 10000) {
      return res.status(400).json({ error: "Body text must be 1-10000 characters" });
    }

    // Verify ownership
    const user = req.user!;
    if (user.role !== "admin") {
      const loc = await pool.query("SELECT user_id FROM locations WHERE id = $1", [location_id]);
      if (loc.rows.length === 0) {
        return res.status(404).json({ error: "Location not found" });
      }
      if (loc.rows[0].user_id !== user.id) {
        return res.status(403).json({ error: "Access denied" });
      }
    }

    const result = await pool.query(
      `INSERT INTO templates (location_id, name, category, body_text)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [location_id, name.trim(), category, body_text]
    );
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update template — verify ownership via location
router.put("/:id", isAuthenticated, async (req, res) => {
  try {
    const { name, category, body_text } = req.body;

    if (!name || !category || !body_text) {
      return res.status(400).json({ error: "name, category, and body_text are required" });
    }
    if (typeof name !== "string" || name.trim().length === 0 || name.length > 255) {
      return res.status(400).json({ error: "Name must be 1-255 characters" });
    }
    if (typeof body_text !== "string" || body_text.trim().length === 0 || body_text.length > 10000) {
      return res.status(400).json({ error: "Body text must be 1-10000 characters" });
    }

    // Verify ownership
    const user = req.user!;
    if (user.role !== "admin") {
      const template = await pool.query(
        "SELECT t.id FROM templates t JOIN locations l ON t.location_id = l.id WHERE t.id = $1 AND l.user_id = $2",
        [req.params.id, user.id]
      );
      if (template.rows.length === 0) {
        return res.status(403).json({ error: "Access denied" });
      }
    }

    const result = await pool.query(
      `UPDATE templates SET name = $1, category = $2, body_text = $3 WHERE id = $4 RETURNING *`,
      [name.trim(), category, body_text, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Template not found" });
    }
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete template — verify ownership via location
router.delete("/:id", isAuthenticated, async (req, res) => {
  try {
    const user = req.user!;
    if (user.role !== "admin") {
      const template = await pool.query(
        "SELECT t.id FROM templates t JOIN locations l ON t.location_id = l.id WHERE t.id = $1 AND l.user_id = $2",
        [req.params.id, user.id]
      );
      if (template.rows.length === 0) {
        return res.status(403).json({ error: "Access denied" });
      }
    }

    await pool.query("DELETE FROM templates WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Apply template (increment usage count) — verify ownership
router.post("/:id/apply", isAuthenticated, async (req, res) => {
  try {
    const user = req.user!;

    let templateQuery;
    if (user.role === "admin") {
      templateQuery = await pool.query("SELECT t.*, l.id as loc_id FROM templates t JOIN locations l ON t.location_id = l.id WHERE t.id = $1", [req.params.id]);
    } else {
      templateQuery = await pool.query(
        "SELECT t.*, l.id as loc_id FROM templates t JOIN locations l ON t.location_id = l.id WHERE t.id = $1 AND l.user_id = $2",
        [req.params.id, user.id]
      );
    }

    if (templateQuery.rows.length === 0) {
      return res.status(404).json({ error: "Template not found" });
    }

    const { reviewer_name, business_name } = req.body;
    const template = templateQuery.rows[0];

    // Get the location's language setting for month locale
    const guidelinesResult = await pool.query(
      "SELECT language FROM guidelines WHERE location_id = $1 ORDER BY version DESC LIMIT 1",
      [template.loc_id]
    );
    const language = guidelinesResult.rows[0]?.language || "bilingual";
    const monthLocale = language === "english" ? "en-US" : "fr-FR";

    let text = template.body_text;
    const now = new Date();
    text = text
      .replace(/{reviewer_name}/g, reviewer_name || "")
      .replace(/{business_name}/g, business_name || "")
      .replace(/{month}/g, now.toLocaleString(monthLocale, { month: "long" }))
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

    if (!Array.isArray(location_ids) || location_ids.length === 0) {
      return res.status(400).json({ error: "location_ids must be a non-empty array" });
    }

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
