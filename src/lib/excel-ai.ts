import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_EXCEL_AI_PLAN, sanitizeExcelAiPlan, type ExcelAiPlan } from "@/core/excel-ai-plan";

/** Asks the server for an AI plan; falls back to the standard plan so the download always works. */
export async function fetchExcelAiPlan(month: string, records: Record<string, string | number | null>[]): Promise<{ plan: ExcelAiPlan; source: string | null }> {
  // Only the claim summary and salary rows that need attention go to Claude, and one answer is reused per month/data.
  const companies = new Map<string, { Company: string; Workers: number; G: number; OT: number; Net: number }>();
  for (const r of records) {
    const c = companies.get(String(r["Company"])) ?? { Company: String(r["Company"]), Workers: 0, G: 0, OT: 0, Net: 0 };
    c.Workers++; c.G += Number(r["G"] ?? 0); c.OT += Number(r["OT"] ?? 0); c.Net += Number(r["Net"] ?? 0);
    companies.set(c.Company, c);
  }
  const attention = records.filter(r => r["Net"] === null || Number(r["OT"] ?? 0) > 80 || r["Status"] !== "Approved").slice(0, 200);
  const compact = [...companies.values(), ...attention];
  const cacheKey = `excel-ai:${month}:${JSON.stringify(compact).length}:${hash(JSON.stringify(compact))}`;
  try {
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) return JSON.parse(cached) as { plan: ExcelAiPlan; source: string | null };
  } catch { /* no cache */ }
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("Not signed in");
    const res = await fetch("/api/public/excel-ai", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ month, records: compact }) });
    const json = await res.json().catch(() => ({})) as { plan?: unknown; provider?: string; model?: string };
    if (res.ok && json.plan) {
      const out = { plan: sanitizeExcelAiPlan(json.plan), source: `${json.provider ?? "AI"} (${json.model ?? ""})` };
      try { sessionStorage.setItem(cacheKey, JSON.stringify(out)); } catch { /* storage full */ }
      return out;
    }
  } catch { /* fall back below */ }
  return { plan: DEFAULT_EXCEL_AI_PLAN, source: null };
}

function hash(text: string) {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
