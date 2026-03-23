import { Router } from "express";
import { isAuthenticated } from "../middleware/auth";
import pool from "../config/db";
import { syncReviewsForLocation, postReply } from "../services/google";
import { generateReply, getGuidelinesForLocation } from "../services/claude";

const router = Router();

// Get reviews for a location
router.get("/location/:locationId", isAuthenticated, async (req, res) => {
  try {
    const { locationId } = req.params;
    const { filter = "all", page = "1" } = req.query;
    const limit = 20;
    const offset = (parseInt(page as string) - 1) * limit;

    let whereClause = "WHERE r.location_id = $1";
    if (filter === "unreplied") whereClause += " AND r.status = 'unreplied'";
    else if (filter === "replied") whereClause += " AND r.status = 'replied'";
    else if (filter === "flagged") whereClause += " AND r.is_flagged = true";

    const result = await pool.query(
      `SELECT r.* FROM reviews r ${whereClause}
       ORDER BY r.posted_at DESC LIMIT $2 OFFSET $3`,
      [locationId, limit, offset]
    );

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM reviews r ${whereClause}`,
      [locationId]
    );

    res.json({
      reviews: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page as string),
      totalPages: Math.ceil(parseInt(countResult.rows[0].count) / limit),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Sync reviews from Google
router.post("/location/:locationId/sync", isAuthenticated, async (req, res) => {
  try {
    const { locationId } = req.params;
    const location = await pool.query("SELECT * FROM locations WHERE id = $1", [locationId]);
    if (location.rows.length === 0) {
      return res.status(404).json({ error: "Location not found" });
    }

    const user = req.user!;
    await syncReviewsForLocation(locationId, location.rows[0].google_location_id, user.access_token);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Generate AI reply
router.post("/:reviewId/generate-reply", isAuthenticated, async (req, res) => {
  try {
    const review = await pool.query("SELECT r.*, l.id as loc_id FROM reviews r JOIN locations l ON r.location_id = l.id WHERE r.id = $1", [req.params.reviewId]);
    if (review.rows.length === 0) {
      return res.status(404).json({ error: "Review not found" });
    }

    const r = review.rows[0];
    const guidelines = await getGuidelinesForLocation(r.loc_id);

    const draft = await generateReply({
      businessName: guidelines.brand_name || "the restaurant",
      reviewerName: r.reviewer_name,
      rating: r.rating,
      reviewText: r.text,
      tone: guidelines.tone,
      language: guidelines.language,
      customInstructions: guidelines.custom_instructions,
    });

    // Log the generated draft
    await pool.query(
      `INSERT INTO reply_logs (review_id, draft_text, source, user_id)
       VALUES ($1, $2, 'ai', $3)`,
      [r.id, draft, req.user!.id]
    );

    res.json({ draft });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Post reply to Google
router.post("/:reviewId/reply", isAuthenticated, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || text.length > 4096) {
      return res.status(400).json({ error: "Reply text is required and must be under 4096 characters" });
    }

    const review = await pool.query("SELECT * FROM reviews WHERE id = $1", [req.params.reviewId]);
    if (review.rows.length === 0) {
      return res.status(404).json({ error: "Review not found" });
    }

    const r = review.rows[0];
    const user = req.user!;

    await postReply(user.access_token, r.google_review_id, text);

    // Update review status
    await pool.query(
      `UPDATE reviews SET reply_text = $1, replied_at = NOW(), status = 'replied' WHERE id = $2`,
      [text, r.id]
    );

    // Log the posted reply
    await pool.query(
      `INSERT INTO reply_logs (review_id, draft_text, final_text, source, posted_at, user_id)
       VALUES ($1, $2, $2, $3, NOW(), $4)`,
      [r.id, text, req.body.source || "manual", user.id]
    );

    // Update location unreplied count
    await pool.query(
      `UPDATE locations SET unreplied_count = (
        SELECT COUNT(*) FROM reviews WHERE location_id = $1 AND (status = 'unreplied' OR status = 'flagged')
      ) WHERE id = $1`,
      [r.location_id]
    );

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: get all flagged reviews
router.get("/admin/flagged", isAuthenticated, async (req, res) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Admin only" });
  }

  try {
    const result = await pool.query(
      `SELECT r.*, l.business_name, l.address
       FROM reviews r JOIN locations l ON r.location_id = l.id
       WHERE r.is_flagged = true AND r.status != 'replied'
       ORDER BY r.posted_at DESC`
    );
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
