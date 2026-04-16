import { Router } from "express";
import { isAuthenticated, ownsLocation, ownsReview } from "../middleware/auth";
import pool from "../config/db";
import { syncReviewsForLocation, postReply } from "../services/google";
import { generateReply, getGuidelinesForLocation } from "../services/claude";

const router = Router();

// Simple in-memory rate limiter for AI generation
const aiRateLimit = new Map<string, number[]>();
const AI_RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const AI_RATE_LIMIT_MAX = 10; // max 10 generations per minute per user

function checkAiRateLimit(userId: string): boolean {
  const now = Date.now();
  const timestamps = (aiRateLimit.get(userId) || []).filter(
    (t) => now - t < AI_RATE_LIMIT_WINDOW_MS
  );
  if (timestamps.length >= AI_RATE_LIMIT_MAX) {
    aiRateLimit.set(userId, timestamps);
    return false;
  }
  timestamps.push(now);
  aiRateLimit.set(userId, timestamps);
  return true;
}

// Get reviews for a location
router.get("/location/:locationId", isAuthenticated, ownsLocation, async (req, res) => {
  try {
    const { locationId } = req.params;
    const page = (req.query.page as string) || "1";
    const filter = (req.query.filter as string) || "all";
    const limit = 20;
    const offset = (parseInt(page as string) - 1) * limit;

    const validFilters = ["all", "unreplied", "replied", "flagged"];
    if (!validFilters.includes(filter)) {
      return res.status(400).json({ error: "Invalid filter" });
    }

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
router.post("/location/:locationId/sync", isAuthenticated, ownsLocation, async (req, res) => {
  try {
    const locationId = req.params.locationId as string;
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
router.post("/:reviewId/generate-reply", isAuthenticated, ownsReview, async (req, res) => {
  try {
    if (!checkAiRateLimit(req.user!.id)) {
      return res.status(429).json({ error: "Too many AI generation requests. Please wait a moment." });
    }

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
router.post("/:reviewId/reply", isAuthenticated, ownsReview, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== "string" || text.trim().length === 0 || text.length > 4096) {
      return res.status(400).json({ error: "Reply text is required and must be under 4096 characters" });
    }

    const review = await pool.query(
      `SELECT r.*, l.user_id as location_owner_id FROM reviews r
       JOIN locations l ON r.location_id = l.id WHERE r.id = $1`,
      [req.params.reviewId]
    );
    if (review.rows.length === 0) {
      return res.status(404).json({ error: "Review not found" });
    }

    const r = review.rows[0];
    const user = req.user!;

    // Use the location owner's token for posting to Google (not the current user's)
    const ownerResult = await pool.query("SELECT access_token FROM users WHERE id = $1", [r.location_owner_id]);
    if (ownerResult.rows.length === 0) {
      return res.status(500).json({ error: "Location owner not found" });
    }

    await postReply(ownerResult.rows[0].access_token, r.google_review_id, text);

    // Update review status
    await pool.query(
      `UPDATE reviews SET reply_text = $1, replied_at = NOW(), status = 'replied' WHERE id = $2`,
      [text, r.id]
    );

    // Log the posted reply
    const source = req.body.source;
    const validSources = ["ai", "template", "manual"];
    await pool.query(
      `INSERT INTO reply_logs (review_id, draft_text, final_text, source, posted_at, user_id)
       VALUES ($1, $2, $2, $3, NOW(), $4)`,
      [r.id, text, validSources.includes(source) ? source : "manual", user.id]
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
