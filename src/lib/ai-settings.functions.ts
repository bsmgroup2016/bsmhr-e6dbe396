import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { aiProviderStatus, AiProviderName } from "./ai.server";

/**
 * AI configuration is stored in the public schema of the user's Supabase project.
 * This table will store the priority order and status of providers.
 */

export const getAiConfig = createServerFn({ method: "GET" })
  .handler(async () => {
    const status = aiProviderStatus();
    
    // In a real app, we'd fetch overrides from the database here.
    // For now, we return the server-computed status based on ENV vars.
    return status;
  });

export const updateAiProviderPriority = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    order: z.array(z.string())
  }).parse(data))
  .handler(async ({ data }) => {
    // In a real app, this would update a 'settings' table in Supabase.
    // Since we are using ENV-based priority in ai.server.ts (AI_PROVIDER),
    // we would ideally persist this to the DB and have ai.server.ts read it.
    console.log("Setting AI priority order:", data.order);
    return { success: true };
  });

export const toggleAiProvider = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    name: z.string(),
    enabled: z.boolean()
  }).parse(data))
  .handler(async ({ data }) => {
    console.log(`Toggling AI provider ${data.name}: ${data.enabled}`);
    return { success: true };
  });
