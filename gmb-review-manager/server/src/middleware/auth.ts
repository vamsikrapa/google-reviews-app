import { Request, Response, NextFunction } from "express";

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
