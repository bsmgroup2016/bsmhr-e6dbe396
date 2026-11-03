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

type TcRow = { date: string; checkIn?: string; checkOut?: string; workerName?: string; employeeCode?: string; fin?: string; projectName?: string; siteName?: string };
const TC_READ =
  "This is a scanned monthly physical time card. Return a JSON array of rows, one per printed day, " +
  'each like {"date":"YYYY-MM-DD","checkIn":"HH:MM","checkOut":"HH:MM","workerName":"printed worker name","employeeCode":"printed P-file number","fin":"printed FIN","projectName":"printed project","siteName":"printed site"}. ' +
  "Repeat the printed card identity and project/site header on each row. Omit any field not legible on the card; never infer an identity or project. Read month and year from the card to produce full dates; never assume the current month. Use 24-hour times. Skip days with no punches. Return [] if the card is unreadable.";

const asRows = (d: unknown): TcRow[] =>
  (Array.isArray(d) ? d : Array.isArray((d as { rows?: unknown })?.rows) ? (d as { rows: unknown[] }).rows : [])
    .filter((r): r is TcRow => !!r && typeof (r as TcRow).date === "string");

/**
 * Dual-AI pipeline: Gemini reads the card, OpenAI audits the same image
 * against Gemini's rows. Agreeing rows get high confidence; disagreements
 * get low confidence + OpenAI's value as a suggestion for manual review.
 * If either provider is unavailable, the other one's read is used alone.
 */
export async function readTimeCard(ref: string) {
  const dataUrl = await fetchAsDataUrl(ref);

  let primary: TcRow[] | null = null;
  let primaryBy = "gemini";
  try {
    primary = asRows(await askAiJson({ instruction: TC_READ, dataUrl, only: "gemini" }));
  } catch (e) {
    console.error("timecard gemini read failed", e);
  }
  if (!primary || primary.length === 0) {
    primaryBy = "fallback";
    primary = asRows(await askAiJson({ instruction: TC_READ, dataUrl }));
  }

  let audit: TcRow[] | null = null;
  if (primaryBy === "gemini") {
    try {
      audit = asRows(
        await askAiJson({
          only: "openai",
          dataUrl,
          instruction:
            "You are auditing another AI's reading of this scanned time card. Look at the image carefully and " +
            "return YOUR OWN reading for every date listed below (plus any punched day it missed), as a JSON " +
            'object {"rows":[{"date":"YYYY-MM-DD","checkIn":"HH:MM","checkOut":"HH:MM"}]}. 24-hour times. ' +
            "Correct digits that were misread; omit a time only if it is truly unreadable.",
          context: `Other AI's reading: ${JSON.stringify(primary)}`,
        }),
      );
    } catch (e) {
      console.error("timecard openai audit failed", e);
    }
  }

  if (!audit) return primary.map((r) => ({ ...r, confidence: 0.75, verifiedBy: primaryBy }));

  const auditMap = new Map(audit.map((r) => [r.date, r]));
  const same = (a?: string, b?: string) => (a ?? "").trim() === (b ?? "").trim();
  const out = primary.map((r) => {
    const a = auditMap.get(r.date);
    auditMap.delete(r.date);
    if (!a) return { ...r, confidence: 0.6, verifiedBy: "gemini" };
    const inOk = same(r.checkIn, a.checkIn);
    const outOk = same(r.checkOut, a.checkOut);
    if (inOk && outOk) return { ...r, confidence: 0.97, verifiedBy: "gemini+openai" };
    return {
      ...r,
      confidence: inOk || outOk ? 0.55 : 0.35,
      suggestion: { checkIn: a.checkIn, checkOut: a.checkOut },
      verifiedBy: "conflict",
    };
  });
  // Days only OpenAI saw — flag for review.
  for (const a of auditMap.values()) {
    out.push({ date: a.date, checkIn: undefined, checkOut: undefined, confidence: 0.3, suggestion: { checkIn: a.checkIn, checkOut: a.checkOut }, verifiedBy: "openai-only" } as never);
  }
  return out.sort((x, y) => x.date.localeCompare(y.date));
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
