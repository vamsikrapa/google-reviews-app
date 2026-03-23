import { Router } from "express";
import { isAuthenticated, isAdmin } from "../middleware/auth";
import pool from "../config/db";
import { syncLocationsForUser } from "../services/google";

const router = Router();

// Get locations for current user (or all for admin)
router.get("/", isAuthenticated, async (req, res) => {
  try {
    const user = req.user!;
    let result;

    if (user.role === "admin") {
      result = await pool.query(
        `SELECT l.*, u.name as owner_name, u.email as owner_email
         FROM locations l JOIN users u ON l.user_id = u.id
         ORDER BY l.unreplied_count DESC`
      );
    } else {
      result = await pool.query(
        "SELECT * FROM locations WHERE user_id = $1 ORDER BY unreplied_count DESC",
        [user.id]
      );
    }

    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Sync locations from Google
router.post("/sync", isAuthenticated, async (req, res) => {
  try {
    const user = req.user!;
    const result = await syncLocationsForUser(user.id, user.access_token);
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get single location
router.get("/:id", isAuthenticated, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM locations WHERE id = $1", [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Location not found" });
    }
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: get all clients
router.get("/admin/clients", isAdmin, async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.name, u.email, u.avatar_url,
              COUNT(l.id) as location_count,
              SUM(l.unreplied_count) as total_unreplied
       FROM users u LEFT JOIN locations l ON u.id = l.user_id
       WHERE u.role = 'client'
       GROUP BY u.id ORDER BY total_unreplied DESC NULLS LAST`
    );
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
