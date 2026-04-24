import { Router } from "express";
import { isAuthenticated } from "../middleware/auth";
import pool from "../config/db";

const router = Router();

const PERSONAS = ["professional", "friendly", "concise", "custom"] as const;
const CHANNELS = ["email", "slack"] as const;
const RATING_OPERATORS = ["eq", "gte", "lte", "gt", "lt"] as const;
const ACTIONS = ["auto_reply", "flag", "notify"] as const;

/* ─────────── Automation Settings (persona + notifications) ─────────── */

// GET /api/automation/settings — returns user's settings, creating defaults if none exist
router.get("/settings", isAuthenticated, async (req, res) => {
  try {
    const userId = req.user!.id;
    const result = await pool.query(
      "SELECT * FROM user_automation_settings WHERE user_id = $1",
      [userId]
    );
    if (result.rows.length === 0) {
      // Return defaults without inserting yet
      return res.json({
        user_id: userId,
        persona: "professional",
        custom_persona_prompt: null,
        signature: "Best regards, The [Business Name] Team",
        notify_response_confirmation: true,
        notify_negative_sentiment: true,
        notify_daily_digest: false,
        notification_channel: "email",
        slack_webhook_url: null,
      });
    }
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/automation/settings — upsert
router.put("/settings", isAuthenticated, async (req, res) => {
  try {
    const userId = req.user!.id;
    const {
      persona,
      custom_persona_prompt,
      signature,
      notify_response_confirmation,
      notify_negative_sentiment,
      notify_daily_digest,
      notification_channel,
      slack_webhook_url,
    } = req.body;

    if (persona && !PERSONAS.includes(persona)) {
      return res.status(400).json({ error: `persona must be one of ${PERSONAS.join(", ")}` });
    }
    if (notification_channel && !CHANNELS.includes(notification_channel)) {
      return res.status(400).json({ error: `notification_channel must be one of ${CHANNELS.join(", ")}` });
    }
    if (signature && typeof signature === "string" && signature.length > 500) {
      return res.status(400).json({ error: "signature too long (max 500 chars)" });
    }
    if (custom_persona_prompt && typeof custom_persona_prompt === "string" && custom_persona_prompt.length > 5000) {
      return res.status(400).json({ error: "custom_persona_prompt too long (max 5000 chars)" });
    }

    const result = await pool.query(
      `INSERT INTO user_automation_settings (
         user_id, persona, custom_persona_prompt, signature,
         notify_response_confirmation, notify_negative_sentiment, notify_daily_digest,
         notification_channel, slack_webhook_url, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         persona = EXCLUDED.persona,
         custom_persona_prompt = EXCLUDED.custom_persona_prompt,
         signature = EXCLUDED.signature,
         notify_response_confirmation = EXCLUDED.notify_response_confirmation,
         notify_negative_sentiment = EXCLUDED.notify_negative_sentiment,
         notify_daily_digest = EXCLUDED.notify_daily_digest,
         notification_channel = EXCLUDED.notification_channel,
         slack_webhook_url = EXCLUDED.slack_webhook_url,
         updated_at = NOW()
       RETURNING *`,
      [
        userId,
        persona ?? "professional",
        custom_persona_prompt ?? null,
        signature ?? "Best regards, The [Business Name] Team",
        notify_response_confirmation ?? true,
        notify_negative_sentiment ?? true,
        notify_daily_digest ?? false,
        notification_channel ?? "email",
        slack_webhook_url ?? null,
      ]
    );
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ─────────── Auto-Reply Rules ─────────── */

// GET /api/automation/rules
router.get("/rules", isAuthenticated, async (req, res) => {
  try {
    const userId = req.user!.id;
    const result = await pool.query(
      "SELECT * FROM auto_reply_rules WHERE user_id = $1 ORDER BY sort_order ASC, created_at ASC",
      [userId]
    );
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/automation/rules
router.post("/rules", isAuthenticated, async (req, res) => {
  try {
    const userId = req.user!.id;
    const {
      name,
      description,
      rating_operator,
      rating_value,
      action,
      delay_minutes,
      is_active,
    } = req.body;

    if (!name || typeof name !== "string" || name.length > 255) {
      return res.status(400).json({ error: "name required (max 255 chars)" });
    }
    if (!RATING_OPERATORS.includes(rating_operator)) {
      return res.status(400).json({ error: `rating_operator must be one of ${RATING_OPERATORS.join(", ")}` });
    }
    if (!Number.isInteger(rating_value) || rating_value < 1 || rating_value > 5) {
      return res.status(400).json({ error: "rating_value must be integer 1-5" });
    }
    if (!ACTIONS.includes(action)) {
      return res.status(400).json({ error: `action must be one of ${ACTIONS.join(", ")}` });
    }
    const delay = Number.isInteger(delay_minutes) ? delay_minutes : 0;
    if (delay < 0 || delay > 10080) {
      return res.status(400).json({ error: "delay_minutes must be 0-10080 (1 week)" });
    }

    const result = await pool.query(
      `INSERT INTO auto_reply_rules
         (user_id, name, description, rating_operator, rating_value, action, delay_minutes, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [userId, name, description ?? null, rating_operator, rating_value, action, delay, is_active ?? true]
    );
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/automation/rules/:id
router.put("/rules/:id", isAuthenticated, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    // Ownership check
    const owned = await pool.query(
      "SELECT id FROM auto_reply_rules WHERE id = $1 AND user_id = $2",
      [id, userId]
    );
    if (owned.rows.length === 0) {
      return res.status(404).json({ error: "Rule not found" });
    }

    const {
      name,
      description,
      rating_operator,
      rating_value,
      action,
      delay_minutes,
      is_active,
    } = req.body;

    // Validate only provided fields
    if (name !== undefined && (typeof name !== "string" || name.length === 0 || name.length > 255)) {
      return res.status(400).json({ error: "name must be 1-255 chars" });
    }
    if (rating_operator !== undefined && !RATING_OPERATORS.includes(rating_operator)) {
      return res.status(400).json({ error: `rating_operator must be one of ${RATING_OPERATORS.join(", ")}` });
    }
    if (rating_value !== undefined && (!Number.isInteger(rating_value) || rating_value < 1 || rating_value > 5)) {
      return res.status(400).json({ error: "rating_value must be integer 1-5" });
    }
    if (action !== undefined && !ACTIONS.includes(action)) {
      return res.status(400).json({ error: `action must be one of ${ACTIONS.join(", ")}` });
    }
    if (delay_minutes !== undefined && (!Number.isInteger(delay_minutes) || delay_minutes < 0 || delay_minutes > 10080)) {
      return res.status(400).json({ error: "delay_minutes must be 0-10080" });
    }

    const result = await pool.query(
      `UPDATE auto_reply_rules SET
         name = COALESCE($1, name),
         description = COALESCE($2, description),
         rating_operator = COALESCE($3, rating_operator),
         rating_value = COALESCE($4, rating_value),
         action = COALESCE($5, action),
         delay_minutes = COALESCE($6, delay_minutes),
         is_active = COALESCE($7, is_active),
         updated_at = NOW()
       WHERE id = $8 AND user_id = $9
       RETURNING *`,
      [
        name ?? null,
        description ?? null,
        rating_operator ?? null,
        rating_value ?? null,
        action ?? null,
        delay_minutes ?? null,
        is_active ?? null,
        id,
        userId,
      ]
    );
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/automation/rules/:id
router.delete("/rules/:id", isAuthenticated, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const result = await pool.query(
      "DELETE FROM auto_reply_rules WHERE id = $1 AND user_id = $2 RETURNING id",
      [id, userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Rule not found" });
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ─────────── Connected Platforms ─────────── */

// GET /api/automation/platforms — real status for Google, placeholders for others
router.get("/platforms", isAuthenticated, async (req, res) => {
  try {
    const userId = req.user!.id;

    // Google: connected if user has an access_token; gather real location/review counts
    const userRow = await pool.query(
      "SELECT access_token, refresh_token FROM users WHERE id = $1",
      [userId]
    );
    const hasGoogleToken = !!userRow.rows[0]?.access_token;

    const locations = await pool.query(
      "SELECT COUNT(*)::int as count FROM locations WHERE user_id = $1",
      [userId]
    );
    const pendingReviews = await pool.query(
      `SELECT COUNT(*)::int as count FROM reviews r
         JOIN locations l ON r.location_id = l.id
         WHERE l.user_id = $1 AND r.status = 'unreplied'`,
      [userId]
    );

    res.json([
      {
        id: "google",
        name: "Google Business",
        status: hasGoogleToken ? "connected" : "disconnected",
        description: hasGoogleToken
          ? `Syncing reviews from ${locations.rows[0].count} locations.`
          : "Not connected. Sign in with Google to start.",
        pending_count: pendingReviews.rows[0].count,
      },
      {
        id: "yelp",
        name: "Yelp",
        status: "coming_soon",
        description: "Yelp integration coming soon.",
        pending_count: 0,
      },
      {
        id: "facebook",
        name: "Facebook",
        status: "coming_soon",
        description: "Facebook integration coming soon.",
        pending_count: 0,
      },
    ]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ─────────── Dashboard Stats ─────────── */

// GET /api/automation/stats — metrics for the dashboard screen
router.get("/stats", isAuthenticated, async (req, res) => {
  try {
    const userId = req.user!.id;

    // Aggregate across all locations owned by this user (or all if admin — keeping scoped)
    const result = await pool.query(
      `SELECT
         COALESCE(AVG(r.rating), 0)::decimal(3,2) as avg_rating,
         COUNT(r.*)::int as total_reviews,
         COUNT(*) FILTER (WHERE r.status = 'unreplied')::int as pending_reviews,
         COUNT(*) FILTER (WHERE r.status = 'replied')::int as replied_reviews,
         COUNT(*) FILTER (WHERE r.reply_mode = 'auto')::int as auto_replied_count
       FROM reviews r
       JOIN locations l ON r.location_id = l.id
       WHERE l.user_id = $1`,
      [userId]
    );
    const row = result.rows[0];
    const total = row.total_reviews || 0;
    const replied = row.replied_reviews || 0;
    const responseRate = total > 0 ? Math.round((replied / total) * 1000) / 10 : 0;
    const automationRate = total > 0 ? Math.round((row.auto_replied_count / total) * 1000) / 10 : 0;

    // Review volume over last 4 weeks
    const volume = await pool.query(
      `SELECT
         DATE_TRUNC('week', COALESCE(r.posted_at, r.created_at)) as week,
         COUNT(*)::int as count
       FROM reviews r
       JOIN locations l ON r.location_id = l.id
       WHERE l.user_id = $1
         AND COALESCE(r.posted_at, r.created_at) >= NOW() - INTERVAL '4 weeks'
       GROUP BY week
       ORDER BY week ASC`,
      [userId]
    );

    res.json({
      avg_rating: parseFloat(row.avg_rating) || 0,
      total_reviews: total,
      pending_reviews: row.pending_reviews || 0,
      response_rate: responseRate,
      automation_rate: automationRate,
      volume_by_week: volume.rows,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
