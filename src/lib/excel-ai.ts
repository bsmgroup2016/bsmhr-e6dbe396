import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_EXCEL_AI_PLAN, sanitizeExcelAiPlan, type ExcelAiPlan } from "@/core/excel-ai-plan";

/** Asks the server for an AI plan; falls back to the standard plan so the download always works. */
export async function fetchExcelAiPlan(month: string, records: Record<string, string | number | null>[]): Promise<{ plan: ExcelAiPlan; source: string | null }> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("Not signed in");
    const res = await fetch("/api/public/excel-ai", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ month, records }) });
    const json = await res.json().catch(() => ({})) as { plan?: unknown; provider?: string; model?: string };
    if (res.ok && json.plan) return { plan: sanitizeExcelAiPlan(json.plan), source: `${json.provider ?? "AI"} (${json.model ?? ""})` };
  } catch { /* fall back below */ }
  return { plan: DEFAULT_EXCEL_AI_PLAN, source: null };
}
