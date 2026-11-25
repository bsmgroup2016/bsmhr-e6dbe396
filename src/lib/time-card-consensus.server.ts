import {
  FLAT_DOCUMENT_JSON_SCHEMA, FLAT_ROW_JSON_SCHEMA,
  flatTimeCardDocumentSchema, flatTimeCardSchema, normalizeFlatRow, calculatedHours,
  flaggedFields, matchingRouterRow, mergeTargetedResolution,
  type ConsensusField, type ConsensusResult, type FlatTimeCard,
} from "@/core/time-card-consensus";
import { TIME_CARD_READ_INSTRUCTION } from "@/core/time-card-read";
import type { ActiveProvider } from "./api-integrations.server";
import { OCR_MODELS } from "@/core/ocr-models";

export const CARBON_MODEL = OCR_MODELS.Gemini;
export const SOL_MODEL = OCR_MODELS.OpenAI;
export const ROUTER_TIMEOUT_MS = 30_000;
const READ_PROMPT = `${TIME_CARD_READ_INSTRUCTION}\nInstead of nested cards/days, return {"rows":[...]} using the supplied flat-row schema. Preserve every worked date, including Sundays, and every distinct physical card. Do not emit genuinely OFF/empty rows. Read dates from the printed date and card's own month/year, never a guessed period. Transcribe printed identity, site, normal-hours and OT-hours separately. Transcribe reported_total_hours only if a total is printed; never add hours or perform arithmetic. Break minutes must be explicitly visible in the document; otherwise null. Illegible cells are null with lowered confidence. Never replace a source value with a plausible default.`;
export const TARGETED_STATIC_PROMPT = `You verify Singapore time-card cells against the original image. Resolve ONLY the supplied flagged field names for ONE identified card/date. Do not change any unflagged cell or perform arithmetic. Illegible values stay null; confidence must reflect uncertainty. Return only the requested keys. Fixed field definitions and schema:\n${JSON.stringify(FLAT_ROW_JSON_SCHEMA)}`;

export interface ConsensusDependencies {
  router: ActiveProvider | null;
  geminiKey: string;
  openaiKey: string;
  fetch?: typeof fetch;
}
export class ConsensusProviderError extends Error {
  constructor(public provider: "Gemini" | "OpenAI" | "9Router", public status: number | null) {
    super(`${provider} OCR ${status === 401 || status === 403 ? "authentication was rejected" : status === 404 ? "requested model is unavailable" : status === 429 ? "rate limit reached" : "verification could not complete"}${status ? ` (HTTP ${status})` : ""}`);
  }
}
function imageParts(dataUrl: string) {
  const match = /^data:(image\/(?:png|jpeg|webp|gif)|application\/pdf);base64,([A-Za-z0-9+/=\r\n]+)$/.exec(dataUrl);
  if (!match) throw new Error("Invalid time-card image or PDF data");
  return { mimeType: match[1], data: match[2], dataUrl };
}
function completionText(value: unknown): string {
  const body = value as { choices?: { message?: { content?: string } }[] };
  return body?.choices?.[0]?.message?.content ?? "";
}
function parseJson(text: string) {
  const clean = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(clean) as unknown;
}
function parseRouterAnswer(text: string): FlatTimeCard[] {
  const answer = parseJson(text);
  // 9Router may return a document, a flat array or one flat row. Structural validation is strict.
  const document = Array.isArray(answer) ? { rows: answer } : answer && typeof answer === "object" && !("rows" in answer) ? { rows: [answer] } : answer;
  if (!document || typeof document !== "object" || !("rows" in document) || !Array.isArray(document.rows)) throw new Error("Invalid 9Router JSON");
  const rows = document.rows.map((value: unknown, index: number) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid 9Router row");
    const raw = value as Record<string, unknown>;
    return { card_index: index + 1, employee_code: null, fin: null, site_name: null, normal_hours: null, ot_hours: null, ...raw };
  });
  return flatTimeCardDocumentSchema.parse({ rows }).rows.map(normalizeFlatRow);
}
async function post(deps: ConsensusDependencies, provider: ConsensusProviderError["provider"], url: string, headers: Record<string, string>, body: unknown, timeout: number): Promise<unknown> {
  const send = deps.fetch ?? fetch;
  let response: Response;
  try {
    response = await send(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(timeout) });
  } catch { throw new ConsensusProviderError(provider, null); }
  if (!response.ok) {
    await response.body?.cancel();
    throw new ConsensusProviderError(provider, response.status);
  }
  try { return await response.json(); } catch { throw new ConsensusProviderError(provider, null); }
}

export function buildRouterRequest(dataUrl: string, router: ActiveProvider) {
  const media = imageParts(dataUrl);
  return {
    model: router.model, stream: false,
    messages: [{ role: "system", content: `${READ_PROMPT}\nJSON schema: ${JSON.stringify(FLAT_DOCUMENT_JSON_SCHEMA)}` }, { role: "user", content: [
      { type: "text", text: "Read every worked date on the original card." },
      media.mimeType === "application/pdf" ? { type: "file", file: { filename: "timecard.pdf", file_data: dataUrl } } : { type: "image_url", image_url: { url: dataUrl } },
    ] }],
  };
}
export function buildGeminiRequest(dataUrl: string, initial: FlatTimeCard[] | null) {
  const media = imageParts(dataUrl);
  return {
    systemInstruction: { parts: [{ text: `${READ_PROMPT}\nIndependently read the original image first. Then verify each initial 9Router cell against the original. Never treat 9Router as ground truth.` }] },
    contents: [{ role: "user", parts: [{ inlineData: { mimeType: media.mimeType, data: media.data } }, { text: `ninerouter_json: ${JSON.stringify(initial)}` }] }],
    generationConfig: { responseMimeType: "application/json", responseJsonSchema: FLAT_DOCUMENT_JSON_SCHEMA, mediaResolution: "MEDIA_RESOLUTION_HIGH", thinkingConfig: { thinkingLevel: "HIGH" } },
  };
}
export function buildOpenAiRequest(dataUrl: string, row: FlatTimeCard, initial: FlatTimeCard | null, fields: ConsensusField[]) {
  const media = imageParts(dataUrl);
  const properties = Object.fromEntries(fields.map(field => [field, FLAT_ROW_JSON_SCHEMA.properties[field]]));
  return {
    model: SOL_MODEL, stream: false, reasoning_effort: "high", max_completion_tokens: 300,
    response_format: { type: "json_schema", json_schema: { name: "timecard_flagged_cells", strict: true, schema: { type: "object", additionalProperties: false, properties, required: fields } } },
    messages: [
      { role: "system", content: TARGETED_STATIC_PROMPT },
      { role: "user", content: [
        media.mimeType === "application/pdf" ? { type: "file", file: { filename: "timecard.pdf", file_data: dataUrl } } : { type: "image_url", image_url: { url: dataUrl } },
        { type: "text", text: JSON.stringify({ card_index: row.card_index, date: row.date, flagged_fields: fields, ninerouter_json: initial, gemini_json: row }) },
      ] },
    ],
  };
}

/** Prepared backend pipeline; no ordinary document reader or provider settings are changed. */
export async function verifyTimeCardConsensus(dataUrl: string, deps: ConsensusDependencies): Promise<ConsensusResult[]> {
  imageParts(dataUrl);
  if (!deps.geminiKey) throw new Error("Official Gemini OCR key is not configured");
  // Step 1 is best-effort and bounded, including invalid JSON and provider failures.
  let initial: FlatTimeCard[] | null = null;
  if (deps.router) {
    try {
      const router = deps.router;
      const response = await post(deps, "9Router", router.url, { Authorization: `Bearer ${router.key}`, ...router.extra }, buildRouterRequest(dataUrl, router), ROUTER_TIMEOUT_MS);
      initial = parseRouterAnswer(completionText(response));
    } catch { initial = null; }
  }
  // Mandatory official Gemini verification: no alternative model/provider silently substitutes.
  const google = await post(deps, "Gemini", `https://generativelanguage.googleapis.com/v1beta/models/${CARBON_MODEL}:generateContent`, { "x-goog-api-key": deps.geminiKey }, buildGeminiRequest(dataUrl, initial), 240_000);
  const response = google as { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[] };
  const text = response.candidates?.[0]?.content?.parts?.filter(part => !part.thought).map(part => part.text ?? "").join("") ?? "";
  let verified: FlatTimeCard[];
  try { verified = flatTimeCardDocumentSchema.parse(parseJson(text)).rows.map(normalizeFlatRow); }
  catch { throw new Error("Gemini returned invalid verified time-card JSON; no unverified result was accepted"); }
  // Never silently discard a worked date that the initial reader saw.
  if (initial?.some(row => !verified.some(candidate => candidate.card_index === row.card_index && candidate.date === row.date))) {
    throw new Error("Uncertain OCR: Gemini did not verify every initially recorded date — verify the original card and retry");
  }
  const results: ConsensusResult[] = [];
  // Sequential requests stay safely below the Worker's six outbound-connection budget.
  for (const [index, verifiedRow] of verified.entries()) {
    const router = matchingRouterRow(initial, verifiedRow, index);
    const fields = flaggedFields(verifiedRow, router);
    let row = verifiedRow, remaining = fields, failed = false;
    if (fields.length) {
      try {
        if (!deps.openaiKey) throw new Error("Official OpenAI OCR key is not configured");
        const answer = await post(deps, "OpenAI", "https://api.openai.com/v1/chat/completions", { Authorization: `Bearer ${deps.openaiKey}` }, buildOpenAiRequest(dataUrl, row, router, fields), 60_000);
        row = mergeTargetedResolution(row, fields, parseJson(completionText(answer)));
        // Compare to math/critical evidence again, not back to superseded 9Router disagreements.
        remaining = flaggedFields(row, null);
        // Written GW/OT still use the existing deterministic claim rule; never AI arithmetic.
        flatTimeCardSchema.parse(row);
      } catch { failed = true; }
    }
    results.push({ row, calculated_hours: calculatedHours(row), flagged_fields: remaining, tie_breaker_failed: failed });
  }
  return results;
}
