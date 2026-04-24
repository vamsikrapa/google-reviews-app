export interface User {
  id: string;
  email: string;
  name: string;
  role: "admin" | "client";
  avatar_url: string;
}

export interface Location {
  id: string;
  user_id: string;
  google_location_id: string;
  business_name: string;
  address: string;
  avg_rating: number;
  review_count: number;
  unreplied_count: number;
  last_synced_at: string;
  owner_name?: string;
  owner_email?: string;
}

export interface Review {
  id: string;
  location_id: string;
  google_review_id: string;
  reviewer_name: string;
  rating: number;
  text: string;
  posted_at: string;
  reply_text: string | null;
  replied_at: string | null;
  is_flagged: boolean;
  status: "unreplied" | "replied" | "flagged";
  business_name?: string;
  address?: string;
}

export interface Template {
  id: string;
  location_id: string;
  name: string;
  category: string;
  body_text: string;
  times_used: number;
  created_at: string;
}

export interface Guidelines {
  id?: string;
  location_id?: string;
  tone: string;
  language: string;
  brand_name: string;
  custom_instructions: string;
  version?: number;
}

export interface ReviewsResponse {
  reviews: Review[];
  total: number;
  page: number;
  totalPages: number;
}

export type PersonaKey = "professional" | "friendly" | "concise" | "custom";
export type NotificationChannel = "email" | "slack";

export interface AutomationSettings {
  user_id: string;
  persona: PersonaKey;
  custom_persona_prompt: string | null;
  signature: string;
  notify_response_confirmation: boolean;
  notify_negative_sentiment: boolean;
  notify_daily_digest: boolean;
  notification_channel: NotificationChannel;
  slack_webhook_url: string | null;
}

export type RatingOperator = "eq" | "gte" | "lte" | "gt" | "lt";
export type RuleAction = "auto_reply" | "flag" | "notify";

export interface AutoReplyRule {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  rating_operator: RatingOperator;
  rating_value: number;
  action: RuleAction;
  delay_minutes: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface PlatformStatus {
  id: "google" | "yelp" | "facebook";
  name: string;
  status: "connected" | "disconnected" | "coming_soon" | "action_needed";
  description: string;
  pending_count: number;
}

export interface DashboardStats {
  avg_rating: number;
  total_reviews: number;
  pending_reviews: number;
  response_rate: number;
  automation_rate: number;
  volume_by_week: { week: string; count: number }[];
}
