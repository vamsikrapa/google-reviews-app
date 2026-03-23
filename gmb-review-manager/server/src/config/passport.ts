import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import pool from "./db";

passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const result = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
    done(null, result.rows[0] || null);
  } catch (err) {
    done(err, null);
  }
});

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL: process.env.GOOGLE_CALLBACK_URL || "http://localhost:3001/api/auth/google/callback",
      scope: [
        "profile",
        "email",
        "https://www.googleapis.com/auth/business.manage",
      ],
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const existingUser = await pool.query(
          "SELECT * FROM users WHERE google_id = $1",
          [profile.id]
        );

        if (existingUser.rows.length > 0) {
          // Update tokens
          await pool.query(
            `UPDATE users SET access_token = $1, refresh_token = COALESCE($2, refresh_token),
             name = $3, email = $4, avatar_url = $5, updated_at = NOW() WHERE google_id = $6`,
            [
              _accessToken,
              _refreshToken,
              profile.displayName,
              profile.emails?.[0]?.value,
              profile.photos?.[0]?.value,
              profile.id,
            ]
          );
          const updated = await pool.query("SELECT * FROM users WHERE google_id = $1", [profile.id]);
          return done(null, updated.rows[0]);
        }

        // Create new user (default role: client)
        const newUser = await pool.query(
          `INSERT INTO users (google_id, email, name, avatar_url, role, access_token, refresh_token)
           VALUES ($1, $2, $3, $4, 'client', $5, $6) RETURNING *`,
          [
            profile.id,
            profile.emails?.[0]?.value,
            profile.displayName,
            profile.photos?.[0]?.value,
            _accessToken,
            _refreshToken,
          ]
        );

        return done(null, newUser.rows[0]);
      } catch (err) {
        return done(err as Error, undefined);
      }
    }
  )
);

export default passport;
