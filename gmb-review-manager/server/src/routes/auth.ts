import { Router } from "express";
import passport from "../config/passport";
import { isAuthenticated } from "../middleware/auth";

const router = Router();

router.get("/google", passport.authenticate("google", {
  scope: ["profile", "email", "https://www.googleapis.com/auth/business.manage"],
  accessType: "offline",
  prompt: "consent",
}));

router.get("/google/callback",
  passport.authenticate("google", { failureRedirect: "/login?error=auth_failed" }),
  (_req, res) => {
    res.redirect("/");
  }
);

router.get("/me", isAuthenticated, (req, res) => {
  const user = req.user!;
  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    avatar_url: user.avatar_url,
  });
});

router.post("/logout", (req, res) => {
  req.logout(() => {
    res.json({ success: true });
  });
});

// Admin: switch to client view
router.post("/switch-user/:userId", isAuthenticated, async (req, res) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Admin only" });
  }
  // Store original admin id and set viewing user
  (req.session as any).originalUserId = req.user.id;
  (req.session as any).viewingAsUserId = req.params.userId;
  res.json({ success: true });
});

router.post("/switch-back", isAuthenticated, (req, res) => {
  delete (req.session as any).viewingAsUserId;
  delete (req.session as any).originalUserId;
  res.json({ success: true });
});

export default router;
