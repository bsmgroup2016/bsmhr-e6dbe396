/** Shared OCR selection; chatbot presets must retain their separate models. */
export const OCR_MODELS = {
  Gemini: "gemini-4-carbon",
  OpenAI: "gpt-6.2-sol",
} as const;

export function integrationPresetModel(category: "ocr" | "chatbot", provider: string, previous: string): string {
  if (category !== "ocr") return previous;
  if (provider === "Gemini") return OCR_MODELS.Gemini;
  if (provider === "OpenAI") return OCR_MODELS.OpenAI;
  return previous;
}