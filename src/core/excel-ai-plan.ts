/**
 * Excel AI "formula plan": the AI only picks which analyses, flags and review notes
 * to include. The software writes every formula and checks it against its own totals,
 * so AI output can never change hours or pay.
 */
export const PIVOT_DIMENSIONS = ["company", "client", "project", "worker"] as const;
export const PIVOT_MEASURES = ["gHours", "otHours", "totalHours", "netPay"] as const;
export type PivotDimension = (typeof PIVOT_DIMENSIONS)[number];
export type PivotMeasure = (typeof PIVOT_MEASURES)[number];

export interface ExcelAiPivot { title: string; rows: PivotDimension; measures: PivotMeasure[] }
export interface ExcelAiNote { severity: "high" | "medium" | "low"; worker: string; message: string }
export interface ExcelAiPlan { pivots: ExcelAiPivot[]; otHoursAbove: number; notes: ExcelAiNote[] }

export const DEFAULT_EXCEL_AI_PLAN: ExcelAiPlan = {
  pivots: [
    { title: "By company", rows: "company", measures: ["gHours", "otHours", "totalHours", "netPay"] },
    { title: "By project", rows: "project", measures: ["gHours", "otHours", "totalHours"] },
    { title: "By client", rows: "client", measures: ["gHours", "otHours", "totalHours"] },
  ],
  otHoursAbove: 100,
  notes: [],
};

const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max) : "");

/** Keeps only known dimensions/measures; anything else from the AI is dropped. */
export function sanitizeExcelAiPlan(raw: unknown): ExcelAiPlan {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const pivots: ExcelAiPivot[] = [];
  const seen = new Set<string>();
  for (const p of Array.isArray(obj["pivots"]) ? obj["pivots"] : []) {
    const r = (p ?? {}) as Record<string, unknown>;
    const rows = r["rows"] as PivotDimension;
    if (!PIVOT_DIMENSIONS.includes(rows)) continue;
    const measures = [...new Set((Array.isArray(r["measures"]) ? r["measures"] : []).filter((m): m is PivotMeasure => PIVOT_MEASURES.includes(m as PivotMeasure)))]
      .filter((m) => m !== "netPay" || rows === "company" || rows === "worker");
    if (!measures.length) continue;
    const key = `${rows}:${measures.join(",")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    pivots.push({ title: text(r["title"], 40) || `By ${rows}`, rows, measures });
    if (pivots.length >= 6) break;
  }
  const ot = Number(obj["otHoursAbove"]);
  const notes: ExcelAiNote[] = [];
  for (const n of Array.isArray(obj["notes"]) ? obj["notes"] : []) {
    const r = (n ?? {}) as Record<string, unknown>;
    const message = text(r["message"], 300);
    if (!message) continue;
    const sev = r["severity"];
    notes.push({ severity: sev === "high" || sev === "low" ? sev : "medium", worker: text(r["worker"], 80), message });
    if (notes.length >= 50) break;
  }
  return {
    pivots: pivots.length ? pivots : DEFAULT_EXCEL_AI_PLAN.pivots,
    otHoursAbove: Number.isFinite(ot) && ot >= 1 && ot <= 400 ? Math.round(ot) : DEFAULT_EXCEL_AI_PLAN.otHoursAbove,
    notes,
  };
}

/** Pulls the first JSON object out of an AI reply (handles ```json fences). */
export function parseExcelAiReply(content: string): ExcelAiPlan {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start < 0 || end <= start) return sanitizeExcelAiPlan(null);
  try { return sanitizeExcelAiPlan(JSON.parse(content.slice(start, end + 1))); } catch { return sanitizeExcelAiPlan(null); }
}

export const EXCEL_AI_SYSTEM_PROMPT = `You design Excel analysis workbooks for a Singapore manpower company's monthly claim and salary data.
You never calculate or change hours or pay; the software computes everything. Reply with ONLY one JSON object:
{"pivots":[{"title":string,"rows":"company"|"client"|"project"|"worker","measures":["gHours"|"otHours"|"totalHours"|"netPay"]}],
 "otHoursAbove":number,
 "notes":[{"severity":"high"|"medium"|"low","worker":string,"message":string}]}
netPay is allowed only for company or worker rows. Choose 2-5 useful pivots. Set otHoursAbove to a sensible monthly OT warning level.
Notes: point out unusual OT, missing payroll, workers with hours but no pay, or duplicates, in short professional English. No other text.`;
