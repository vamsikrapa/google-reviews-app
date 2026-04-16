import pool from "../config/db";

const GBP_API_BASE = "https://mybusinessbusinessinformation.googleapis.com/v1";
const GBP_ACCOUNT_API = "https://mybusinessaccountmanagement.googleapis.com/v1";

async function fetchWithToken(url: string, accessToken: string, options: RequestInit = {}): Promise<any> {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Google API error (${res.status}): ${error}`);
  }
  return res.json();
}

export async function getAccounts(accessToken: string) {
  const data = await fetchWithToken(`${GBP_ACCOUNT_API}/accounts`, accessToken);
  return data.accounts || [];
}

export async function getLocations(accessToken: string, accountName: string) {
  const data = await fetchWithToken(
    `${GBP_API_BASE}/${accountName}/locations?readMask=name,title,storefrontAddress,metadata`,
    accessToken
  );
  return data.locations || [];
}

export async function getReviews(accessToken: string, locationName: string, pageToken?: string) {
  let url = `https://mybusiness.googleapis.com/v4/${locationName}/reviews?pageSize=50`;
  if (pageToken) url += `&pageToken=${pageToken}`;
  const data = await fetchWithToken(url, accessToken);
  return data;
}

export async function postReply(
  accessToken: string,
  reviewName: string,
  replyText: string
) {
  const url = `https://mybusiness.googleapis.com/v4/${reviewName}/reply`;
  const data = await fetchWithToken(url, accessToken, {
    method: "PUT",
    body: JSON.stringify({ comment: replyText }),
  });
  return data;
}

export async function deleteReply(accessToken: string, reviewName: string) {
  const url = `https://mybusiness.googleapis.com/v4/${reviewName}/reply`;
  await fetchWithToken(url, accessToken, { method: "DELETE" });
}

export async function syncLocationsForUser(userId: string, accessToken: string): Promise<import("pg").QueryResult> {
  const accounts = await getAccounts(accessToken);

  for (const account of accounts) {
    const locations = await getLocations(accessToken, account.name);

    for (const loc of locations) {
      const address = loc.storefrontAddress
        ? [
            loc.storefrontAddress.addressLines?.join(", "),
            loc.storefrontAddress.locality,
            loc.storefrontAddress.postalCode,
          ]
            .filter(Boolean)
            .join(", ")
        : "";

      await pool.query(
        `INSERT INTO locations (user_id, google_location_id, business_name, address, last_synced_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (google_location_id) DO UPDATE SET
           business_name = EXCLUDED.business_name,
           address = EXCLUDED.address,
           last_synced_at = NOW()`,
        [userId, loc.name, loc.title || "Unnamed Location", address]
      );
    }
  }

  return pool.query("SELECT * FROM locations WHERE user_id = $1 ORDER BY unreplied_count DESC", [userId]);
}

export async function syncReviewsForLocation(locationId: string, googleLocationId: string, accessToken: string) {
  let pageToken: string | undefined;

  do {
    const data = await getReviews(accessToken, googleLocationId, pageToken);
    const reviews = data.reviews || [];

    for (const review of reviews) {
      const rating = review.starRating === "ONE" ? 1
        : review.starRating === "TWO" ? 2
        : review.starRating === "THREE" ? 3
        : review.starRating === "FOUR" ? 4
        : review.starRating === "FIVE" ? 5 : 0;

      const isFlagged = rating <= 2;
      const hasReply = !!review.reviewReply;
      const status = isFlagged && !hasReply ? "flagged" : hasReply ? "replied" : "unreplied";

      await pool.query(
        `INSERT INTO reviews (location_id, google_review_id, reviewer_name, rating, text, posted_at, reply_text, replied_at, is_flagged, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (google_review_id) DO UPDATE SET
           reply_text = EXCLUDED.reply_text,
           replied_at = EXCLUDED.replied_at,
           status = EXCLUDED.status,
           is_flagged = EXCLUDED.is_flagged`,
        [
          locationId,
          review.name,
          review.reviewer?.displayName || "Anonymous",
          rating,
          review.comment || "",
          review.createTime,
          review.reviewReply?.comment || null,
          review.reviewReply?.updateTime || null,
          isFlagged,
          status,
        ]
      );
    }

    pageToken = data.nextPageToken;
  } while (pageToken);

  // Update location counts
  const counts = await pool.query(
    `SELECT
       COUNT(*) as total,
       COUNT(*) FILTER (WHERE status = 'unreplied' OR status = 'flagged') as unreplied,
       COALESCE(AVG(rating), 0) as avg_rating
     FROM reviews WHERE location_id = $1`,
    [locationId]
  );

  await pool.query(
    `UPDATE locations SET review_count = $1, unreplied_count = $2, avg_rating = $3, last_synced_at = NOW() WHERE id = $4`,
    [counts.rows[0].total, counts.rows[0].unreplied, parseFloat(counts.rows[0].avg_rating).toFixed(1), locationId]
  );
}
