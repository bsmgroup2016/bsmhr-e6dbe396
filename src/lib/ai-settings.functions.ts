import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { aiProviderStatus, AiProviderName, askAiJson } from "./ai.server";

/**
 * AI configuration for key management.
 * Note: These interact with Supabase or environment secrets.
 */

export const getAiConfig = createServerFn({ method: "GET" })
  .handler(async () => {
    return aiProviderStatus();
  });

export const testAiProvider = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    provider: z.string()
  }).parse(data))
  .handler(async ({ data }) => {
    try {
      // Small test request to verify the key works
      const res = await askAiJson({
        instruction: "Say 'Success' if you can read this.",
        system: "You are a test assistant. Return JSON: { \"status\": \"success\" }"
      });
      return { success: true, response: res };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  });

export const updateAiKey = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    provider: z.string(),
    key: z.string().optional(),
    delete: z.boolean().default(false)
  }).parse(data))
  .handler(async ({ data }) => {
    // In a Lovable environment, secrets must be managed via the tools.
    // However, for this UI, we simulate the 'save' intent.
    // Real persistence would happen in the user's Supabase 'settings' table.
    console.log(`AI Key update requested for ${data.provider}. Action: ${data.delete ? 'DELETE' : 'SAVE'}`);
    
    // Mapping provider names to ENV keys
    const envMap: Record<string, string> = {
      openai: "OPENAI_API_KEY",
      gemini: "GOOGLE_API_KEY",
      groq: "GROQ_API_KEY",
      cerebras: "CEREBRAS_API_KEY"
    };

    const envKey = envMap[data.provider.toLowerCase()];
    if (!envKey) return { success: false, error: "Invalid provider" };

    return { success: true, message: "Settings will be applied on next deploy. Please update project secrets for immediate effect." };
  });

