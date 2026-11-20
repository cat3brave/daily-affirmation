import "server-only";

export function isGeminiTranslationEnabled() {
  return process.env.GEMINI_TRANSLATION_ENABLED !== "false";
}
