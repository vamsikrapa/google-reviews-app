-- GMB Review Manager - Database Schema
-- Run this in your Supabase SQL Editor

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_id VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  avatar_url TEXT,
  role VARCHAR(20) DEFAULT 'client' CHECK (role IN ('admin', 'client')),
  access_token TEXT,
  refresh_token TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Locations table
CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  google_location_id VARCHAR(500) UNIQUE NOT NULL,
  business_name VARCHAR(500) NOT NULL,
  address TEXT,
  avg_rating DECIMAL(2,1) DEFAULT 0,
  review_count INTEGER DEFAULT 0,
  unreplied_count INTEGER DEFAULT 0,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reviews table
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  google_review_id VARCHAR(500) UNIQUE NOT NULL,
  reviewer_name VARCHAR(255),
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  text TEXT,
  posted_at TIMESTAMPTZ,
  reply_text TEXT,
  replied_at TIMESTAMPTZ,
  is_flagged BOOLEAN DEFAULT false,
  status VARCHAR(20) DEFAULT 'unreplied' CHECK (status IN ('unreplied', 'replied', 'flagged')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reply logs table
CREATE TABLE IF NOT EXISTS reply_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID REFERENCES reviews(id) ON DELETE CASCADE,
  draft_text TEXT,
  final_text TEXT,
  source VARCHAR(20) CHECK (source IN ('ai', 'template', 'manual')),
  posted_at TIMESTAMPTZ,
  user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Templates table
CREATE TABLE IF NOT EXISTS templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  body_text TEXT NOT NULL,
  times_used INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Guidelines table
CREATE TABLE IF NOT EXISTS guidelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  tone VARCHAR(255) DEFAULT 'Friendly & Warm',
  language VARCHAR(50) DEFAULT 'bilingual',
  brand_name VARCHAR(255),
  custom_instructions TEXT,
  version INTEGER DEFAULT 1,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User-level automation settings (persona + notifications)
CREATE TABLE IF NOT EXISTS user_automation_settings (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  persona VARCHAR(20) DEFAULT 'professional' CHECK (persona IN ('professional', 'friendly', 'concise', 'custom')),
  custom_persona_prompt TEXT,
  signature TEXT DEFAULT 'Best regards, The [Business Name] Team',
  notify_response_confirmation BOOLEAN DEFAULT true,
  notify_negative_sentiment BOOLEAN DEFAULT true,
  notify_daily_digest BOOLEAN DEFAULT false,
  notification_channel VARCHAR(20) DEFAULT 'email' CHECK (notification_channel IN ('email', 'slack')),
  slack_webhook_url TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-reply rules (per user)
CREATE TABLE IF NOT EXISTS auto_reply_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  rating_operator VARCHAR(10) NOT NULL CHECK (rating_operator IN ('eq', 'gte', 'lte', 'gt', 'lt')),
  rating_value INTEGER NOT NULL CHECK (rating_value BETWEEN 1 AND 5),
  action VARCHAR(20) NOT NULL CHECK (action IN ('auto_reply', 'flag', 'notify')),
  delay_minutes INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sessions table (for connect-pg-simple)
CREATE TABLE IF NOT EXISTS sessions (
  sid VARCHAR NOT NULL COLLATE "default",
  sess JSON NOT NULL,
  expire TIMESTAMPTZ(6) NOT NULL,
  PRIMARY KEY (sid)
);
CREATE INDEX IF NOT EXISTS idx_sessions_expire ON sessions(expire);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_locations_user_id ON locations(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_location_id ON reviews(location_id);
CREATE INDEX IF NOT EXISTS idx_reviews_status ON reviews(status);
CREATE INDEX IF NOT EXISTS idx_reviews_is_flagged ON reviews(is_flagged);
CREATE INDEX IF NOT EXISTS idx_reply_logs_review_id ON reply_logs(review_id);
CREATE INDEX IF NOT EXISTS idx_templates_location_id ON templates(location_id);
CREATE INDEX IF NOT EXISTS idx_guidelines_location_id ON guidelines(location_id);
CREATE INDEX IF NOT EXISTS idx_auto_reply_rules_user_id ON auto_reply_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_auto_reply_rules_active ON auto_reply_rules(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_reviews_sentiment ON reviews(sentiment);

-- Reviews: sentiment + reply mode additions (nullable for backwards compat)
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS sentiment VARCHAR(20)
  CHECK (sentiment IN ('very_positive', 'positive', 'neutral', 'negative', 'very_negative'));
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS sentiment_tags TEXT[];
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS reply_mode VARCHAR(20) DEFAULT 'manual'
  CHECK (reply_mode IN ('auto', 'draft', 'manual', 'flagged'));
