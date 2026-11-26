import { z } from "zod";

export const HR_BRAIN_MODEL = "hr-brain";
export const HR_BRAIN_BASE_URL = "https://hr.seobdshop.com/v1";

const messageSchema = z.object({
  role: z.enum(["system", "user", "assistant", "tool"]),
  content: z.union([z.string(), z.array(z.record(z.unknown())), z.null()]),
  name: z.string().optional(),
  tool_call_id: z.string().optional(),
  tool_calls: z.array(z.record(z.unknown())).optional(),
});

export const hrBrainSchema = z.object({
  messages: z.array(messageSchema).min(1).max(200),
  systemPrompt: z.string().max(100_000).optional(),
  stream: z.boolean().default(false),
  max_tokens: z.number().int().positive().transform((n) => Math.max(1024, n)).default(2048),
  temperature: z.number().min(0).max(2).optional(),
  tools: z.array(z.object({
    type: z.literal("function"),
    function: z.object({
      name: z.string().min(1), description: z.string().optional(),
      parameters: z.record(z.unknown()).optional(), strict: z.boolean().optional(),
    }),
  })).optional(),
});

export type HrBrainRequest = z.input<typeof hrBrainSchema>;
export type HrBrainResponse = {
  id?: string;
  model: string;
  choices: { message: { role?: string; content: string | null; tool_calls?: Record<string, unknown>[] }; finish_reason?: string | null }[];
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
};

export function hrBrainBody(input: unknown) {
  const { systemPrompt, messages, ...options } = hrBrainSchema.parse(input);
  return {
    ...options,
    model: HR_BRAIN_MODEL,
    messages: systemPrompt ? [{ role: "system", content: systemPrompt }, ...messages] : messages,
  };
}