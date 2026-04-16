import { Request, Response, NextFunction } from "express";
import pool from "../config/db";

export interface AuthUser {
  id: string;
  google_id: string;
  email: string;
  name: string;
  role: "admin" | "client";
  access_token: string;
  refresh_token: string;
  avatar_url: string;
}

declare global {
  namespace Express {
    interface User extends AuthUser {}
  }
}

export function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: "Not authenticated" });
}

export function isAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated() && req.user?.role === "admin") {
    return next();
  }
  res.status(403).json({ error: "Admin access required" });
}

/**
 * Middleware that verifies the current user owns the location specified by :locationId.
 * Admins bypass the ownership check.
 */
export function ownsLocation(req: Request, res: Response, next: NextFunction) {
  const locationId = req.params.locationId || req.params.id;
  if (!locationId) {
    return res.status(400).json({ error: "Location ID required" });
  }

  const user = req.user!;
  if (user.role === "admin") {
    return next();
  }

  pool.query("SELECT user_id FROM locations WHERE id = $1", [locationId])
    .then((result) => {
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Location not found" });
      }
      if (result.rows[0].user_id !== user.id) {
        return res.status(403).json({ error: "Access denied" });
      }
      next();
    })
    .catch((err) => {
      res.status(500).json({ error: err.message });
    });
}

/**
 * Middleware that verifies the current user owns the review specified by :reviewId.
 * Admins bypass the ownership check.
 */
export function ownsReview(req: Request, res: Response, next: NextFunction) {
  const reviewId = req.params.reviewId;
  if (!reviewId) {
    return res.status(400).json({ error: "Review ID required" });
  }

  const user = req.user!;
  if (user.role === "admin") {
    return next();
  }

  pool.query(
    "SELECT l.user_id FROM reviews r JOIN locations l ON r.location_id = l.id WHERE r.id = $1",
    [reviewId]
  )
    .then((result) => {
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Review not found" });
      }
      if (result.rows[0].user_id !== user.id) {
        return res.status(403).json({ error: "Access denied" });
      }
      next();
    })
    .catch((err) => {
      res.status(500).json({ error: err.message });
    });
}
