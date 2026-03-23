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
