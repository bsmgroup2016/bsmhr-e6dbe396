/**
 * OCR extraction service — SINGLE integration point.
 *
 * Documents live in R2, so the reading happens server-side: the server fns in
 * `ocr.functions.ts` presign the object and send it to the AI gateway's vision
 * model. Manual entry still works everywhere, OCR only pre-fills.
 */
import { ocrIpa, ocrTimeCard } from "@/lib/ocr.functions";

export type OcrResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: string };

export const OCR_NOT_CONFIGURED = "OCR could not read this file — fill manually";

/** OCR runs through the AI gateway on the server. */
export function isOcrConfigured(): boolean {
  return true;
}

export type IpaExtract = {
  name?: string;
  fin?: string;
  passportNumber?: string;
  workPermitNumber?: string;
  nationality?: string;
  dateOfBirth?: string;
  issueDate?: string;
  expiryDate?: string;
  occupation?: string;
};

export type TimeCardExtractRow = {
  date: string;
  checkIn?: string;
  checkOut?: string;
};

/** Reads a Singapore IPA / work-pass file and returns the fields to auto-fill. */
export async function extractIpaData(fileUrl: string): Promise<OcrResult<IpaExtract>> {
  if (!fileUrl) return { ok: false, reason: "Upload the IPA copy first" };
  try {
    const data = (await ocrIpa({ data: { ref: fileUrl } })) as IpaExtract;
    if (!data || Object.keys(data).length === 0) return { ok: false, reason: OCR_NOT_CONFIGURED };
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
    const rows = (await ocrTimeCard({ data: { ref: fileUrl } })) as TimeCardExtractRow[];
    const clean = (rows ?? []).filter((r) => r && typeof r.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.date));
    if (clean.length === 0) return { ok: false, reason: OCR_NOT_CONFIGURED };
    return { ok: true, data: clean };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : OCR_NOT_CONFIGURED };
  }
}