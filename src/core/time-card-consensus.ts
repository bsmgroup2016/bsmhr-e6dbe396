import { z } from "zod";
import { splitDutyHours } from "./work-hours";
import type { ReadRow } from "./time-card-read";

export const CONSENSUS_FIELDS = ["employee_name", "date", "in_time", "out_time", "break_minutes", "reported_total_hours", "confidence", "employee_code", "fin", "site_name", "normal_hours", "ot_hours"] as const;
export type ConsensusField = typeof CONSENSUS_FIELDS[number];
const nullableText = z.string().nullable();
const nullableHours = z.number().finite().min(0).max(24).nullable();
export const flatTimeCardSchema = z.object({
  card_index: z.number().int().min(1),
  employee_name: nullableText, date: nullableText, in_time: nullableText, out_time: nullableText,
  break_minutes: z.number().finite().min(0).max(1440).nullable(),
  reported_total_hours: nullableHours, confidence: z.number().min(0).max(1),
  employee_code: nullableText, fin: nullableText, site_name: nullableText,
  normal_hours: nullableHours, ot_hours: nullableHours,
}).strict();
export type FlatTimeCard = z.infer<typeof flatTimeCardSchema>;
export const flatTimeCardDocumentSchema = z.object({ rows: z.array(flatTimeCardSchema).min(1).max(256) }).strict();

const textProperty = { type: ["string", "null"] };
const hourProperty = { type: ["number", "null"], minimum: 0, maximum: 24 };
export const FLAT_ROW_JSON_SCHEMA = {
  type: "object", additionalProperties: false,
  properties: {
    card_index: { type: "integer", minimum: 1 },
    employee_name: textProperty, date: textProperty, in_time: textProperty, out_time: textProperty,
    break_minutes: { type: ["number", "null"], minimum: 0, maximum: 1440 },
    reported_total_hours: hourProperty, confidence: { type: "number", minimum: 0, maximum: 1 },
    employee_code: textProperty, fin: textProperty, site_name: textProperty, normal_hours: hourProperty, ot_hours: hourProperty,
  }, required: ["card_index", ...CONSENSUS_FIELDS],
};
export const FLAT_DOCUMENT_JSON_SCHEMA = {
  type: "object", additionalProperties: false,
  properties: { rows: { type: "array", items: FLAT_ROW_JSON_SCHEMA } }, required: ["rows"],
};

export function normalizeDate(value: string | null): string | null {
  if (!value) return null;
  const raw = value.trim();
  const iso = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(raw);
  const local = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(raw);
  const parts = iso ? [iso[1], iso[2], iso[3]] : local ? [local[3], local[2], local[1]] : null;
  if (!parts) return null;
  const [year, month, day] = parts.map(Number);
  if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate()) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
export function normalizeTime(value: string | null): string | null {
  if (!value) return null;
  const match = /^(\d{1,2}):?(\d{2})$/.exec(value.trim().replace(/\s/g, ""));
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) return null;
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}
export function normalizeFlatRow(row: FlatTimeCard): FlatTimeCard {
  const printedTotal = row.normal_hours !== null && row.ot_hours !== null ? row.normal_hours + row.ot_hours : null;
  return { ...row, employee_name: row.employee_name?.trim() || null, date: normalizeDate(row.date), in_time: normalizeTime(row.in_time), out_time: normalizeTime(row.out_time), reported_total_hours: row.reported_total_hours ?? printedTotal };
}
const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
export function calculatedHours(row: FlatTimeCard): number | null {
  const normalized = normalizeFlatRow(row);
  if (!normalized.in_time || !normalized.out_time || normalized.break_minutes === null) return null;
  const duration = minutes(normalized.out_time) - minutes(normalized.in_time);
  if (duration <= 0 || normalized.break_minutes > duration) return null;
  return (duration - normalized.break_minutes) / 60;
}

export function flaggedFields(gemini: FlatTimeCard, router: FlatTimeCard | null): ConsensusField[] {
  const verified = normalizeFlatRow(gemini), initial = router ? normalizeFlatRow(router) : null;
  const flagged = new Set<ConsensusField>();
  for (const field of CONSENSUS_FIELDS) {
    if (initial && initial[field] !== verified[field]) flagged.add(field);
  }
  for (const field of ["employee_name", "date", "in_time", "out_time"] as const) {
    if (verified[field] === null || verified.confidence < 0.8) flagged.add(field);
  }
  if (verified.confidence < 0.8) flagged.add("confidence");
  if (verified.break_minutes === null) flagged.add("break_minutes");
  if (verified.reported_total_hours === null) flagged.add("reported_total_hours");
  if (verified.in_time && verified.out_time && minutes(verified.out_time) <= minutes(verified.in_time)) {
    flagged.add("in_time"); flagged.add("out_time");
  }
  const hours = calculatedHours(verified);
  if (hours === null && verified.in_time && verified.out_time && verified.break_minutes !== null) flagged.add("break_minutes");
  if (hours !== null && verified.reported_total_hours !== null && Math.abs(hours - verified.reported_total_hours) > 0.25) {
    flagged.add("reported_total_hours"); flagged.add("in_time"); flagged.add("out_time"); flagged.add("break_minutes");
  }
  return [...flagged];
}

export function matchingRouterRow(rows: FlatTimeCard[] | null, row: FlatTimeCard, index: number): FlatTimeCard | null {
  if (!rows) return null;
  const dated = rows.filter(candidate => candidate.card_index === row.card_index && normalizeDate(candidate.date) === normalizeDate(row.date) && normalizeDate(row.date) !== null);
  if (dated.length === 1) return dated[0] ?? null;
  const indexed = rows[index];
  return indexed?.card_index === row.card_index ? indexed : null;
}
export function mergeTargetedResolution(row: FlatTimeCard, fields: ConsensusField[], resolution: unknown): FlatTimeCard {
  if (!resolution || typeof resolution !== "object" || Array.isArray(resolution)) throw new Error("Invalid targeted OCR answer");
  const answer = resolution as Record<string, unknown>;
  if (Object.keys(answer).some(key => !fields.includes(key as ConsensusField)) || fields.some(field => !(field in answer))) throw new Error("Targeted OCR answer does not match the flagged fields");
  const patch = Object.fromEntries(fields.map(field => [field, answer[field]]));
  return normalizeFlatRow(flatTimeCardSchema.parse({ ...row, ...patch }));
}

export interface ConsensusResult { row: FlatTimeCard; calculated_hours: number | null; flagged_fields: ConsensusField[]; tie_breaker_failed: boolean }
export function toExistingClaimRows(results: ConsensusResult[]): ReadRow[] {
  const seen = new Set<string>();
  return results.map(result => {
    const row = normalizeFlatRow(result.row);
    if (!row.date) throw new Error("Unclear time-card date — verify the original card and retry; no date was invented");
    const identity = `${row.card_index}:${row.date}`;
    if (seen.has(identity)) throw new Error("Duplicate time-card date — verify the original card; no recorded row was removed");
    seen.add(identity);
    const span = row.in_time && row.out_time ? (minutes(row.out_time) - minutes(row.in_time)) / 60 : null;
    const duty = span !== null && span > 0 ? splitDutyHours(span) : null;
    const needsReview = result.flagged_fields.length > 0 || result.tie_breaker_failed;
    return {
      cardIndex: row.card_index, date: row.date,
      ...(row.employee_name ? { workerName: row.employee_name } : {}),
      ...(row.employee_code ? { employeeCode: row.employee_code } : {}),
      ...(row.fin ? { fin: row.fin } : {}), ...(row.site_name ? { siteName: row.site_name } : {}),
      ...(row.in_time ? { checkIn: row.in_time } : {}), ...(row.out_time ? { checkOut: row.out_time } : {}),
      ...(row.normal_hours !== null ? { normalHours: row.normal_hours } : duty ? { normalHours: duty.normalHours } : {}),
      ...(row.ot_hours !== null ? { otHours: row.ot_hours } : duty ? { otHours: duty.otHours } : {}),
      confidence: needsReview ? Math.min(row.confidence, 0.45) : row.confidence,
      verifiedBy: needsReview ? "conflict" : "gemini-4-carbon",
      ...(needsReview ? { remarks: `Uncertain OCR: ${result.flagged_fields.join(", ") || "tie-breaker unavailable"} — verify the original card` } : {}),
    };
  });
}
