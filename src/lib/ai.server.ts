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

import { activeProviders } from "./api-integrations.server";

/** "gemini" / "openai" for the built-in pair; any other provider uses its label. */
export type AiProviderName = string;

interface ProviderConfig {
  name: AiProviderName;
  label: string;
  url: string;
  apiKey: string;
  model: string;
  extra: Record<string, string>;
}

/** OCR providers come from Settings → API Integration (fallback order, on/off, keys). */
async function configured(): Promise<ProviderConfig[]> {
  const list = await activeProviders("ocr");
  return list.map((p) => ({
    name: p.url.includes("googleapis.com") ? "gemini" : p.url.includes("api.openai.com") ? "openai" : p.name,
    label: p.name,
    url: p.url,
    apiKey: p.key,
    model: p.model,
    extra: p.extra,
  }));
}

/** Which OCR providers this deployment can use right now. */
export async function aiProviderStatus() {
  const list = await configured();
  return {
    providers: list.map((p) => ({ name: p.name, label: p.label, model: p.model, vision: true })),
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
        req.dataUrl.startsWith("data:application/pdf")
          ? { type: "file", file: { filename: "document.pdf", file_data: req.dataUrl } }
          : { type: "image_url", image_url: { url: req.dataUrl } },
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
  let list = await configured();
  // If the pinned provider is off/missing, fall back to the normal order.
  if (req.only && !list.some((p) => p.name === req.only)) req = { ...req, only: undefined };
  if (req.only) list = list.filter((p) => p.name === req.only);
  if (list.length === 0) {
    throw new Error("No OCR provider is configured — add the Gemini or OpenAI key in Settings → API Integration");
  }

  let lastError: Error | null = null;
  for (const provider of list) {
    try {
      const res = await fetch(provider.url, {
        method: "POST",
        headers: { Authorization: `Bearer ${provider.apiKey}`, "Content-Type": "application/json", ...provider.extra },
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
