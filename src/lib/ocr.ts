/**
 * OCR extraction service — SINGLE integration point.
 *
 * Documents live in R2, so the reading happens server-side: the authenticated
 * endpoint `/api/public/ocr` verifies the caller owns (or may access) the
 * object, presigns it and sends it to the AI gateway's vision model.
 * Manual entry still works everywhere, OCR only pre-fills.
 */
import { supabase } from "@/integrations/supabase/client";
import type { IpaExtract } from "@/core/ipa-registration";
export type { IpaExtract } from "@/core/ipa-registration";

const OCR_URL = "/api/public/ocr";
const AI_STATUS_URL = "/api/public/ai-status";

export interface AiStatus {
  providers: { name: string; model: string }[];
  primary: string | null;
  fallback: string | null;
  configured: boolean;
}

/** Admin-only: which AI provider is live and which is the backup. */
export async function checkAiStatus(): Promise<AiStatus> {
  const { data: session } = await supabase.auth.getSession();
  const token = session.session?.access_token;
  const res = await fetch(AI_STATUS_URL, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("AI status needs an admin account");
  return (await res.json()) as AiStatus;
}

type OcrPayload =
  | { kind: "ipa" | "timecard" | "passport" | "medical" | "particular" | "csoc"; ref: string }
  | { kind: "columns"; headers: string[]; fields: string[] };

async function callOcr(payload: OcrPayload): Promise<unknown> {
  const { data: session } = await supabase.auth.getSession();
  const token = session.session?.access_token;
  if (!token) throw new Error("Sign in again to use OCR");
  const res = await fetch(OCR_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    let message = OCR_NOT_CONFIGURED;
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) message = body.error;
    } catch {
      /* non-JSON error body */
    }
    if (res.status === 401) message = "Sign in again to use OCR";
    if (res.status === 404) message = "You do not have access to this file";
    throw new Error(message);
  }
  const body = (await res.json()) as { data?: unknown };
  return body.data;
}

export type OcrResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: string };

export const OCR_NOT_CONFIGURED = "OCR could not read this file — fill manually";

/** OCR runs through the AI gateway on the server. */
export function isOcrConfigured(): boolean {
  return true;
}

export type TimeCardExtractRow = {
  date: string;
  checkIn?: string;
  checkOut?: string;
  confidence?: number;
  /** Second AI's (OpenAI) differing reading, for manual review. */
  suggestion?: { checkIn?: string; checkOut?: string };
  verifiedBy?: string;
};

export type PassportExtract = {
  docKind?: string;
  name?: string;
  documentNumber?: string;
  fin?: string;
  nationality?: string;
  dateOfBirth?: string;
  issueDate?: string;
  expiryDate?: string;
  occupation?: string;
  employerName?: string;
};

export async function extractParticularData(fileUrl: string): Promise<OcrResult<Record<string, unknown>>> {
  try {
    const data = await callOcr({ kind: "particular", ref: fileUrl });
    if (!data || typeof data !== "object" || Array.isArray(data)) return { ok: false, reason: OCR_NOT_CONFIGURED };
    return { ok: true, data: data as Record<string, unknown> };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : OCR_NOT_CONFIGURED };
  }
}

export async function extractCsocData(fileUrl: string): Promise<OcrResult<Record<string, unknown>>> {
  try {
    const data = await callOcr({ kind: "csoc", ref: fileUrl });
    if (!data || typeof data !== "object" || Array.isArray(data)) return { ok: false, reason: OCR_NOT_CONFIGURED };
    return { ok: true, data: data as Record<string, unknown> };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : OCR_NOT_CONFIGURED };
  }
}

export type MedicalBillExtract = {
  patientName?: string;
  clinicName?: string;
  billNumber?: string;
  visitDate?: string;
  amount?: number;
  gstAmount?: number;
  diagnosis?: string;
  billType?: string;
};

/** Reads a Singapore IPA / work-pass file and returns the fields to auto-fill. */
export async function extractIpaData(fileUrl: string): Promise<OcrResult<IpaExtract>> {
  if (!fileUrl) return { ok: false, reason: "Upload the IPA copy first" };
  try {
    const data = (await callOcr({ kind: "ipa", ref: fileUrl })) as IpaExtract;
    if (!data || Object.keys(data).length === 0) return { ok: false, reason: OCR_NOT_CONFIGURED };
    return { ok: true, data };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : OCR_NOT_CONFIGURED };
  }
}

/** Reads a passport bio page or WP / S-Pass card — mainly for the expiry date. */
export async function extractPassportData(
  fileUrl: string,
): Promise<OcrResult<PassportExtract>> {
  if (!fileUrl) return { ok: false, reason: "Upload the document first" };
  try {
    const data = (await callOcr({ kind: "passport", ref: fileUrl })) as PassportExtract;
    if (!data || Object.keys(data).length === 0) return { ok: false, reason: OCR_NOT_CONFIGURED };
    return { ok: true, data };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : OCR_NOT_CONFIGURED };
  }
}

/** Reads a clinic bill / receipt so a medical claim pre-fills. */
export async function extractMedicalBill(
  fileUrl: string,
): Promise<OcrResult<MedicalBillExtract>> {
  if (!fileUrl) return { ok: false, reason: "Upload the bill first" };
  try {
    const data = (await callOcr({ kind: "medical", ref: fileUrl })) as MedicalBillExtract;
    if (!data || Object.keys(data).length === 0) return { ok: false, reason: OCR_NOT_CONFIGURED };
    if (data.amount != null) data.amount = Number(data.amount) || 0;
    if (data.gstAmount != null) data.gstAmount = Number(data.gstAmount) || 0;
    return { ok: true, data };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : OCR_NOT_CONFIGURED };
  }
}

/** AI column auto-mapping for XLSX bulk import: header -> our field name. */
export async function autoMapColumns(
  headers: string[],
  fields: string[],
): Promise<OcrResult<Record<string, string>>> {
  if (headers.length === 0) return { ok: false, reason: "No columns found in the file" };
  try {
    const data = (await callOcr({ kind: "columns", headers, fields })) as Record<string, string>;
    if (!data || Object.keys(data).length === 0) {
      return { ok: false, reason: "Could not match the columns — map them manually" };
    }
    return { ok: true, data };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : OCR_NOT_CONFIGURED };
  }
}

/**
 * Reads a scanned 30-day physical time card and returns day-by-day rows that
 * populate the same editable grid the admin fills manually today.
 */
export async function extractTimeCardData(
  fileUrl: string,
): Promise<OcrResult<TimeCardExtractRow[]>> {
  if (!fileUrl) return { ok: false, reason: "Upload the time card first" };
  try {
    const rows = (await callOcr({ kind: "timecard", ref: fileUrl })) as TimeCardExtractRow[];
    const clean = (rows ?? []).filter((r) => r && typeof r.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.date));
    if (clean.length === 0) return { ok: false, reason: OCR_NOT_CONFIGURED };
    return { ok: true, data: clean };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : OCR_NOT_CONFIGURED };
  }
}