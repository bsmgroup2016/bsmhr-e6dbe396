/**
 * Document reading (OCR) — every read goes through the shared AI provider
 * layer, so the Lovable gateway and a personal OpenAI key are interchangeable.
 */
import { askAiJson } from "@/lib/ai.server";
import { keyFromRef, presignGet } from "@/lib/r2.server";

/** Fetch an R2 object (by key) as a data URL. Only our own bucket is readable. */
async function fetchAsDataUrl(ref: string) {
  const key = keyFromRef(ref);
  if (!key || /^https?:/i.test(key)) throw new Error("Invalid file reference");
  const url = await presignGet(key, 300);
  const res = await fetch(url);
  if (!res.ok) throw new Error("Could not read the uploaded file");
  const type = res.headers.get("content-type") || "application/octet-stream";
  const buffer = new Uint8Array(await res.arrayBuffer());
  let binary = "";
  for (let i = 0; i < buffer.length; i += 0x8000) {
    binary += String.fromCharCode(...buffer.subarray(i, i + 0x8000));
  }
  return `data:${type};base64,${btoa(binary)}`;
}

async function readFile(ref: string, instruction: string) {
  return askAiJson({ instruction, dataUrl: await fetchAsDataUrl(ref) });
}

export async function readIpa(ref: string) {
  const data = await readFile(
    ref,
    "This is a Singapore MOM In-Principle Approval (IPA) letter or work pass card. " +
      "Return a JSON object with any of these keys you can read: name, fin, passportNumber, " +
      "workPermitNumber, nationality, dateOfBirth, issueDate, expiryDate, occupation, declaredSalary.",
  );
  return data as Record<string, string>;
}

export async function readTimeCard(ref: string) {
  const data = await readFile(
    ref,
    "This is a scanned monthly physical time card. Return a JSON array of rows, one per printed day, " +
      'each like {"date":"YYYY-MM-DD","checkIn":"HH:MM","checkOut":"HH:MM"}. ' +
      "Use 24-hour times. Skip days with no punches. Return [] if the card is unreadable.",
  );
  return Array.isArray(data) ? (data as Record<string, string>[]) : [];
}

/** Passport bio page or Work Permit / S-Pass card → identity + expiry dates. */
export async function readPassport(ref: string) {
  const data = await readFile(
    ref,
    "This is a passport biodata page, a Singapore Work Permit card or an S-Pass card. " +
      "Return a JSON object with any of these keys you can read: docKind " +
      '("Passport" | "Work Permit" | "S Pass" | "Employment Pass"), name, documentNumber, fin, ' +
      "nationality, dateOfBirth, issueDate, expiryDate, occupation, employerName.",
  );
  return data as Record<string, string>;
}

/** Medical bill / receipt → amount, date, clinic, so claims pre-fill. */
export async function readMedicalBill(ref: string) {
  const data = await readFile(
    ref,
    "This is a Singapore clinic or hospital medical bill / receipt / invoice. Return a JSON object " +
      "with any of these keys you can read: patientName, clinicName, billNumber, visitDate, " +
      "amount (number, total payable in SGD, no currency symbol), gstAmount (number), " +
      'diagnosis, billType ("Consultation" | "Medical Checkup" | "Hospitalisation" | "Dental" | "Other").',
  );
  return data as Record<string, string | number>;
}

/**
 * Bulk-import helper: map spreadsheet headers onto our own employee fields so
 * the admin does not have to re-label every client's column names by hand.
 */
export async function mapColumns(headers: string[], fields: string[]) {
  const data = await askAiJson({
    system:
      "You map spreadsheet column headers onto a fixed list of database field names. " +
      "Return strict JSON only. Never invent field names outside the provided list.",
    instruction:
      "Match each spreadsheet header to the single best target field. Return a JSON object " +
      'shaped {"mapping":{"<header>":"<field or empty string>"}}. Use an empty string when no ' +
      "field fits. Headers are from a Singapore manpower-supply HR import file.",
    context: `Spreadsheet headers: ${JSON.stringify(headers)}\nTarget fields: ${JSON.stringify(fields)}`,
  });
  const mapping = (data as { mapping?: Record<string, string> })?.mapping ?? {};
  const allowed = new Set(fields);
  const clean: Record<string, string> = {};
  for (const [header, field] of Object.entries(mapping)) {
    if (headers.includes(header) && allowed.has(field)) clean[header] = field;
  }
  return clean;
}
