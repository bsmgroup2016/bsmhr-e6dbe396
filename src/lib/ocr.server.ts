/**
 * Document reading (OCR) — every read goes through the shared AI provider
 * layer, so the Lovable gateway and a personal OpenAI key are interchangeable.
 */
import { askAiJson } from "@/lib/ai.server";
import { cardDisputes, disputeInstruction, mergeCardReads, parseCardReads, TIME_CARD_READ_INSTRUCTION } from "@/core/time-card-read";
import { keyFromRef, presignGet } from "@/lib/r2.server";
import { IPA_INSTRUCTION, type IpaExtract } from "@/core/ipa-registration";
import { PARTICULAR_INSTRUCTION, DOCUMENT_UNDERSTANDING, IDENTITY_DOCUMENT_INSTRUCTION, CSOC_INSTRUCTION } from "@/core/employee-document-fields";

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
    `${DOCUMENT_UNDERSTANDING}\n${IPA_INSTRUCTION}`,
  );
  return data as IpaExtract;
}

export async function readParticular(ref: string) {
  return readFile(ref, PARTICULAR_INSTRUCTION);
}

export async function readCsoc(ref: string) {
  return readFile(ref, CSOC_INSTRUCTION);
}

/**
 * Time cards: Gemini and OpenAI each read the WHOLE card independently and in
 * parallel; rows are merged day by day. Agreement = high confidence; any
 * difference is flagged with the other reading for human review.
 * Claude (when configured) is used sparingly: only when both read the card and still disagree,
 * and then it is asked about just those dates / card details, not the whole card. Everything
 * else (one reader failing, unclear cards) is left flagged for the human review step.
 */
export async function readTimeCard(ref: string) {
  const dataUrl = await fetchAsDataUrl(ref);
  const read = (only: string) => askAiJson({ instruction: TIME_CARD_READ_INSTRUCTION, dataUrl, only, strict: true }).then(parseCardReads);
  const [gemini, openai] = await Promise.allSettled([read("gemini"), read("openai")]);
  const g = gemini.status === "fulfilled" && gemini.value.length ? gemini.value : null;
  const o = openai.status === "fulfilled" && openai.value.length ? openai.value : null;
  if (gemini.status === "rejected") console.error("timecard gemini read failed", gemini.reason);
  if (openai.status === "rejected") console.error("timecard openai read failed", openai.reason);
  if (g && o) {
    const names = { primary: "gemini", audit: "openai", third: "claude" };
    const disputes = cardDisputes(g, o);
    if (!disputes.length) return mergeCardReads(g, o, names);
    const c = await askAiJson({ instruction: disputeInstruction(disputes), dataUrl, only: "claude", strict: true, effort: "medium" })
      .then(parseCardReads)
      .catch((e) => {
        if (!/not enabled/.test(String(e?.message ?? e))) console.error("timecard claude tie-break failed", e);
        return [];
      });
    return mergeCardReads(g, o, names, c.length ? c : null);
  }
  if (g) return mergeCardReads(g, null, { primary: "gemini" });
  if (o) return mergeCardReads(o, null, { primary: "openai" });
  // Re-asking the same providers that just failed only doubles the wait.
  const ran = [gemini, openai].filter((r) => !(r.status === "rejected" && /not enabled/.test(String(r.reason?.message ?? r.reason))));
  if (ran.length) {
    const failure = ran.find((r): r is PromiseRejectedResult => r.status === "rejected");
    throw failure?.reason instanceof Error ? failure.reason : new Error("Nothing readable was found on this time card");
  }
  // Neither pinned provider is enabled: use any other configured OCR provider.
  const any = parseCardReads(await askAiJson({ instruction: TIME_CARD_READ_INSTRUCTION, dataUrl }));
  return mergeCardReads(any, null, { primary: "fallback" });
}

/** Passport bio page or Work Permit / S-Pass card → identity + expiry dates. */
export async function readPassport(ref: string) {
  const data = await readFile(
    ref,
    IDENTITY_DOCUMENT_INSTRUCTION,
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
