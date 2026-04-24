import express from "express";
import cors from "cors";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import dotenv from "dotenv";
import passport from "./config/passport";
import pool from "./config/db";
import authRoutes from "./routes/auth";
import locationRoutes from "./routes/locations";
import reviewRoutes from "./routes/reviews";
import templateRoutes from "./routes/templates";
import guidelineRoutes from "./routes/guidelines";
import automationRoutes from "./routes/automation";

dotenv.config();

if (!process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET environment variable is required");
}

const app = express();
const PORT = process.env.PORT || 3001;

const PgStore = connectPgSimple(session);

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:5173",
  credentials: true,
}));
app.use(express.json());

app.set("trust proxy", 1);

app.use(session({
  store: new PgStore({
    pool,
    tableName: "sessions",
    createTableIfMissing: true,
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  },
}));
app.use(passport.initialize());
app.use(passport.session());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/locations", locationRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/templates", templateRoutes);
app.use("/api/guidelines", guidelineRoutes);
app.use("/api/automation", automationRoutes);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Only listen when running directly (not as a Vercel serverless function)
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

export default app;
