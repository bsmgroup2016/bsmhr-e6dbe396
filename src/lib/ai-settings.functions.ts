import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** OCR providers (Gemini + OpenAI) status. */
export const getAiConfig = createServerFn({ method: "GET" }).handler(async () => {
  const { aiProviderStatus } = await import("./ai.server");
  return aiProviderStatus();
});

/** AI chatbot providers (Gemini #1, Gemini #2, Groq, OpenRouter) status. */
export const getAssistantConfig = createServerFn({ method: "GET" }).handler(async () => {
  const { assistantStatus } = await import("./assistant.server");
  const active = assistantStatus();
  const slots = ["Gemini #1", "Gemini #2", "Groq", "OpenRouter"];
  return slots.map((name) => {
    const found = active.find((a) => a.name === name);
    return { name, model: found?.model ?? null, url: found?.url ?? null, configured: !!found };
  });
});

/** Test one OCR provider. */
export const testAiProvider = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ provider: z.enum(["gemini", "openai"]) }).parse(data))
  .handler(async ({ data }) => {
    try {
      const { askAiJson } = await import("./ai.server");
      const res = await askAiJson({
        instruction: "Reply now.",
        system: 'Return JSON only: { "status": "success" }',
        only: data.provider,
      });
      return { success: true, response: res as any, error: null };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e), response: null };
    }
  });

/** Test one chatbot provider. */
export const testAssistantKey = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ provider: z.enum(["Gemini #1", "Gemini #2", "Groq", "OpenRouter"]) }).parse(data))
  .handler(async ({ data }) => {
    try {
      const { testAssistantProvider } = await import("./assistant.server");
      return await testAssistantProvider(data.provider);
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  });
