import "server-only";

export function isGeminiAffirmationEnabled() {
  return process.env.GEMINI_AFFIRMATION_ENABLED !== "false";
}
