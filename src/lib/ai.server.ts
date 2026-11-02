/**
 * OCR / document AI layer — used ONLY for scanning time cards & documents,
 * filling the claim-sheet Excel and building claim sheets.
 *
 * Exactly two paid providers (both read images):
 *   1. Google Gemini (GOOGLE_API_KEY or GEMINI_API_KEY) — reads the scan
 *   2. OpenAI        (OPENAI_API_KEY)                  — audits / fallback
 *
 * The AI chatbot uses its OWN separate keys (see assistant.server.ts).
 */

export type AiProviderName = "gemini" | "openai";

interface ProviderConfig {
  name: AiProviderName;
  url: string;
  apiKey: string;
  model: string;
  vision: boolean;
}

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

function configured(): ProviderConfig[] {
  const env = process.env;
  const list: ProviderConfig[] = [];
  const gKey = env.GOOGLE_API_KEY || env.GEMINI_API_KEY;
  if (gKey) {
    list.push({ name: "gemini", url: GEMINI_URL, apiKey: gKey, model: env.GOOGLE_MODEL || "gemini-2.5-flash", vision: true });
  }
  if (env.OPENAI_API_KEY) {
    list.push({ name: "openai", url: OPENAI_URL, apiKey: env.OPENAI_API_KEY, model: env.OPENAI_MODEL || "gpt-4o", vision: true });
  }
  return list;
}

/** Which OCR providers this deployment can use right now (for Settings / health). */
export function aiProviderStatus() {
  const list = configured();
  return {
    providers: list.map((p) => ({ name: p.name, model: p.model, vision: p.vision })),
    primary: list[0]?.name ?? null,
    fallback: list[1]?.name ?? null,
    backups: list.slice(1).map((p) => p.name),
    configured: list.length > 0,
  };
}

export interface AiRequest {
  instruction: string;
  system?: string;
  /** Optional image / PDF page as a data URL for vision reads. */
  dataUrl?: string;
  context?: string;
  /** Use only this provider (no fallback). */
  only?: AiProviderName;
}

function buildBody(provider: ProviderConfig, req: AiRequest) {
  const prompt = req.context ? `${req.instruction}\n\n${req.context}` : req.instruction;
  const userContent = req.dataUrl
    ? [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: req.dataUrl } },
      ]
    : prompt;
  return {
    model: provider.model,
    messages: [
      {
        role: "system",
        content:
          req.system ??
          "You read scanned Singapore HR documents and return strict JSON only. " +
            "Never invent values: omit any field you cannot read. Dates must be YYYY-MM-DD.",
      },
      { role: "user", content: userContent },
    ],
  };
}

function extractJson(text: string): unknown {
  const match = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (!match) throw new Error("Nothing readable was found in the document");
  return JSON.parse(match[0]) as unknown;
}

/** Ask Gemini / OpenAI for a JSON answer, falling back on failure. */
export async function askAiJson(req: AiRequest): Promise<unknown> {
  let list = configured();
  if (req.only) list = list.filter((p) => p.name === req.only);
  if (list.length === 0) {
    throw new Error("No OCR provider is configured — add the Gemini or OpenAI key in Settings → OCR");
  }

  let lastError: Error | null = null;
  for (const provider of list) {
    try {
      const res = await fetch(provider.url, {
        method: "POST",
        headers: { Authorization: `Bearer ${provider.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(buildBody(provider, req)),
      });
      if (!res.ok) {
        const detail = (await res.text()).slice(0, 400);
        if (res.status === 429) throw new Error(`${provider.name}: rate limit reached`);
        throw new Error(`${provider.name} failed (${res.status}): ${detail}`);
      }
      const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      return extractJson(json.choices?.[0]?.message?.content ?? "");
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      console.error(`OCR provider ${provider.name} failed:`, lastError.message);
    }
  }
  throw lastError ?? new Error("OCR request failed");
}
