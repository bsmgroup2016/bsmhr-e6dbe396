/**
 * OCR extraction service — SINGLE integration point.
 *
 * Both functions below are the ONLY place OCR is wired in. Today they return
 * `{ ok: false, reason: "OCR not configured" }` because
 * GOOGLE_CLOUD_VISION_API_KEY is not available yet. Every upload, form,
 * grid and verification flow around them is fully functional with manual
 * entry, so adding the key later means editing only this file.
 */

export type OcrResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: string };

export const OCR_NOT_CONFIGURED = "OCR not yet configured — fill manually for now";

/** Flip to true only when the Vision API key is wired into the functions below. */
export function isOcrConfigured(): boolean {
  return false;
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

/**
 * Reads a Singapore IPA / work-pass PDF and returns the fields to auto-fill.
 * TODO(OCR): call the Vision API with GOOGLE_CLOUD_VISION_API_KEY here and
 * return `{ ok: true, data }`. Nothing outside this function changes.
 */
export async function extractIpaData(_fileUrl: string): Promise<OcrResult<IpaExtract>> {
  if (!isOcrConfigured()) return { ok: false, reason: OCR_NOT_CONFIGURED };
  return { ok: false, reason: OCR_NOT_CONFIGURED };
}

/**
 * Reads a scanned 30-day physical time card and returns day-by-day rows that
 * populate the same editable grid the admin fills manually today.
 * TODO(OCR): call the Vision API with GOOGLE_CLOUD_VISION_API_KEY here.
 */
export async function extractTimeCardData(
  _fileUrl: string,
): Promise<OcrResult<TimeCardExtractRow[]>> {
  if (!isOcrConfigured()) return { ok: false, reason: OCR_NOT_CONFIGURED };
  return { ok: false, reason: OCR_NOT_CONFIGURED };
}