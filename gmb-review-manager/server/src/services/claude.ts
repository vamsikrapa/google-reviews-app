import Anthropic from "@anthropic-ai/sdk";
import pool from "../config/db";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface ReviewContext {
  businessName: string;
  reviewerName: string;
  rating: number;
  reviewText: string;
  tone: string;
  language: string;
  customInstructions: string;
}

function getRatingInstruction(rating: number): string {
  if (rating <= 2) {
    return "This is a negative review. Respond with empathy, acknowledge the issue without admitting liability, apologise for the experience, and invite the reviewer to contact the restaurant directly to resolve the matter. Do not be defensive.";
  }
  if (rating === 3) {
    return "This is a neutral review. Acknowledge what went well, address any concern raised briefly, and invite the reviewer to return for a better experience.";
  }
  return "This is a positive review. Express warm gratitude, reference something specific from the review if possible, and invite them to return soon.";
}

function getLanguageInstruction(language: string): string {
  switch (language) {
    case "french":
      return "Reply ONLY in French.";
    case "english":
      return "Reply ONLY in English.";
    case "bilingual":
    default:
      return "Reply in the same language as the review. If the review is in French, reply in French. If in English, reply in English.";
  }
}

export async function generateReply(context: ReviewContext): Promise<string> {
  const systemPrompt = `You are a professional review response assistant for ${context.businessName}, a restaurant in France.

Guidelines:
- Tone: ${context.tone || "Friendly & Warm"}
- Language: ${getLanguageInstruction(context.language)}
- Star rating: ${context.rating}/5 — ${getRatingInstruction(context.rating)}
- Always address the reviewer as ${context.reviewerName} if available.
- Additional rules: ${context.customInstructions || "None"}
- Maximum 4096 characters. No hashtags. No markdown. No emojis unless the review uses them.`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250514",
    max_tokens: 1024,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: `Review text: "${context.reviewText}"

Generate a reply to this review following the guidelines above.`,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  return textBlock?.text || "Unable to generate reply.";
}

export async function getGuidelinesForLocation(locationId: string) {
  const result = await pool.query(
    "SELECT * FROM guidelines WHERE location_id = $1 ORDER BY version DESC LIMIT 1",
    [locationId]
  );
  return result.rows[0] || { tone: "Friendly & Warm", language: "bilingual", brand_name: "", custom_instructions: "" };
}
