import { Router } from "express";
import { isAuthenticated, ownsLocation } from "../middleware/auth";
import pool from "../config/db";

const router = Router();

// Get guidelines for a location
router.get("/location/:locationId", isAuthenticated, ownsLocation, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM guidelines WHERE location_id = $1 ORDER BY version DESC LIMIT 1",
      [req.params.locationId]
    );
    if (result.rows.length === 0) {
      return res.json({
        tone: "Friendly & Warm",
        language: "bilingual",
        brand_name: "",
        custom_instructions: "",
      });
    }
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update guidelines (creates new version)
router.put("/location/:locationId", isAuthenticated, ownsLocation, async (req, res) => {
  try {
    const { locationId } = req.params;
    const { tone, language, brand_name, custom_instructions } = req.body;

    // Get current version
    const current = await pool.query(
      "SELECT version FROM guidelines WHERE location_id = $1 ORDER BY version DESC LIMIT 1",
      [locationId]
    );
    const nextVersion = current.rows.length > 0 ? current.rows[0].version + 1 : 1;

    const result = await pool.query(
      `INSERT INTO guidelines (location_id, tone, language, brand_name, custom_instructions, version)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [locationId, tone, language, brand_name, custom_instructions, nextVersion]
    );

    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get guidelines history
router.get("/location/:locationId/history", isAuthenticated, ownsLocation, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM guidelines WHERE location_id = $1 ORDER BY version DESC",
      [req.params.locationId]
    );
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
