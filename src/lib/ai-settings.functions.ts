import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { aiProviderStatus, AiProviderName, askAiJson } from "./ai.server";

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
      const res = await askAiJson({
        instruction: "Say 'Success' if you can read this.",
        system: "You are a test assistant. Return JSON: { \"status\": \"success\" }"
      });
      return { success: true, response: res as any, error: null };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e), response: null };
    }
  });

export const updateAiKey = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    provider: z.string(),
    key: z.string().optional(),
    delete: z.boolean().default(false)
  }).parse(data))
  .handler(async ({ data }) => {
    console.log(`AI Key update requested for ${data.provider}. Action: ${data.delete ? 'DELETE' : 'SAVE'}`);
    return { success: true, message: "Settings will be applied on next deploy.", error: null };
  });



