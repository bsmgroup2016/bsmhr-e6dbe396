/**
 * Claude (Anthropic) document reader. Dormant until an admin adds an OCR provider in
 * Settings → API Integration whose URL is on api.anthropic.com and gives it a key.
 */
import Anthropic from "@anthropic-ai/sdk";

export const isClaudeUrl = (url: string) => url.includes("api.anthropic.com");

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
type ImageType = (typeof IMAGE_TYPES)[number];

export interface ClaudeRead {
  apiKey: string;
  model: string;
  system: string;
  prompt: string;
  dataUrl?: string;
  timeoutMs: number;
  effort?: "low" | "medium" | "high";
}

/** One Messages API call; returns Claude's text answer. */
export async function askClaude(req: ClaudeRead): Promise<string> {
  const client = new Anthropic({ apiKey: req.apiKey, timeout: req.timeoutMs, maxRetries: 1 });
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  if (req.dataUrl) {
    const m = /^data:([^;,]+);base64,(.+)$/.exec(req.dataUrl);
    if (!m) throw new Error("claude: unreadable file data");
    const [, type, data] = m;
    if (type === "application/pdf") content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data } });
    else if ((IMAGE_TYPES as readonly string[]).includes(type)) content.push({ type: "image", source: { type: "base64", media_type: type as ImageType, data } });
    else throw new Error(`claude cannot read ${type} files — use JPG, PNG, WEBP or PDF`);
  }
  content.push({ type: "text", text: req.prompt });

  const response = await client.beta.messages.stream({
    model: req.model,
    max_tokens: req.effort === "high" || !req.effort ? 32000 : 8000,
    // Accuracy over speed by default; narrow tie-break questions pass a lower effort to save cost.
    thinking: { type: "adaptive" },
    output_config: { effort: req.effort ?? "high" },
    // If the model declines a document, the API retries on its default substitute model.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: req.system,
    messages: [{ role: "user", content }],
  }).finalMessage();

  if (response.stop_reason === "refusal") throw new Error("claude declined to read this document");
  if (response.stop_reason === "max_tokens") throw new Error("claude: answer was cut off");
  return response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
}

/** Settings → API Integration "Test" button for a Claude row. */
export async function pingClaude(apiKey: string, model: string) {
  try {
    await new Anthropic({ apiKey, maxRetries: 0 }).messages.create({
      model, max_tokens: 64, messages: [{ role: "user", content: "Reply with OK" }],
    });
    return { success: true, error: null as string | null };
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return { success: false, error: "Claude rejected the API key" };
    if (e instanceof Anthropic.NotFoundError) return { success: false, error: `Claude model "${model}" was not found` };
    if (e instanceof Anthropic.RateLimitError) return { success: false, error: "Limit reached for now (the next one in the list will take over)" };
    if (e instanceof Anthropic.APIError) return { success: false, error: `Failed (${e.status}): ${e.message.slice(0, 200)}` };
    return { success: false, error: e instanceof Error ? e.message : "Claude could not be reached" };
  }
}
