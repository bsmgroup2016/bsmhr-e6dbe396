/** Server-only: editable API integrations (OCR + chatbot) stored in the database. */
import { isClaudeUrl, pingClaude } from "./claude.server";
const SUPABASE_URL = "https://thrfyeyqafmdnpexgmlc.supabase.co";

export type Category = "ocr" | "chatbot";
export interface IntegrationRow {
  id: string;
  category: Category;
  label: string;
  url: string;
  model: string;
  api_key: string | null;
  env_key: string | null;
  priority: number;
  enabled: boolean;
  updated_at: string;
}
export interface ActiveProvider {
  id: string;
  name: string;
  url: string;
  key: string;
  model: string;
  extra: Record<string, string>;
}

function headers() {
  const key = process.env.SB_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Service key missing");
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=representation" };
}

export async function rest<T = unknown>(path: string, init?: RequestInit): Promise<T[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers: { ...headers(), ...(init?.headers ?? {}) } });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  const t = await res.text();
  return t ? (JSON.parse(t) as T[]) : [];
}

export async function isAdmin(userId: string) {
  const rows = await rest(`user_roles?select=role&user_id=eq.${userId}&role=eq.admin`);
  return rows.length > 0;
}

let cache: { at: number; rows: IntegrationRow[] } | null = null;
export function clearIntegrationCache() {
  cache = null;
}

export async function listIntegrations(): Promise<IntegrationRow[]> {
  if (cache && Date.now() - cache.at < 30_000) return cache.rows;
  const rows = await rest<IntegrationRow>("api_integrations?select=*&order=category.asc,priority.asc");
  cache = { at: Date.now(), rows };
  return rows;
}

export function effectiveKey(r: IntegrationRow): string | null {
  return r.api_key || (r.env_key ? process.env[r.env_key] || null : null);
}

export function toProvider(r: IntegrationRow): ActiveProvider | null {
  const key = effectiveKey(r);
  if (!key) return null;
  const extra: Record<string, string> = {};
  if (r.url.includes("googleapis.com")) extra["x-goog-api-key"] = key;
  if (r.url.includes("openrouter.ai")) extra["X-Title"] = "BSM Workforce Assistant";
  return { id: r.id, name: r.label, url: r.url, key, model: r.model, extra };
}

/** Enabled providers with a usable key, in fallback order. */
export async function activeProviders(category: Category): Promise<ActiveProvider[]> {
  const rows = await listIntegrations();
  return rows
    // Claude is wired for document reading only; the chatbot speaks the OpenAI-style API.
    .filter((r) => r.category === category && r.enabled && !(category === "chatbot" && isClaudeUrl(r.url)))
    .sort((a, b) => a.priority - b.priority)
    .map(toProvider)
    .filter((p): p is ActiveProvider => !!p);
}

/** Gemini's newest model is often overloaded (503); retry once on a steadier Gemini model. */
export const GEMINI_BUSY_FALLBACK = "gemini-3-flash-preview";
export async function postChat(p: ActiveProvider, body: Record<string, unknown>) {
  const send = (model: string) =>
    fetch(p.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${p.key}`, "Content-Type": "application/json", ...p.extra },
      body: JSON.stringify({ ...body, model }),
    });
  const res = await send(p.model);
  if (res.status === 503 && p.url.includes("googleapis.com") && p.model !== GEMINI_BUSY_FALLBACK) {
    return send(GEMINI_BUSY_FALLBACK);
  }
  return res;
}

/** Send one tiny message to confirm a provider works. */
export async function pingProvider(p: ActiveProvider) {
  if (isClaudeUrl(p.url)) return pingClaude(p.key, p.model);
  const res = await postChat(p, { messages: [{ role: "user", content: "Reply with OK" }] });
  if (res.ok) return { success: true, error: null as string | null };
  if (res.status === 503) return { success: false, error: "Model is busy right now (high demand) — the next one in the list will take over" };
  if (res.status === 429) return { success: false, error: "Limit reached for now (the next one in the list will take over)" };
  return { success: false, error: `Failed (${res.status}): ${(await res.text()).slice(0, 200)}` };
}
