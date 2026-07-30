import { keyFromRef, presignGet } from "@/lib/r2.server";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

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

async function askGateway(dataUrl: string, instruction: string) {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("OCR is not configured");
  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: "system",
          content:
            "You read scanned Singapore HR documents and return strict JSON only. " +
            "Never invent values: omit any field you cannot read. Dates must be YYYY-MM-DD.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: instruction },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
    }),
  });
  if (res.status === 429) throw new Error("OCR rate limit reached — try again shortly");
  if (res.status === 402) throw new Error("AI credits exhausted — top up to use OCR");
  if (!res.ok) throw new Error(`OCR failed (${res.status})`);
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = json.choices?.[0]?.message?.content ?? "";
  const match = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (!match) throw new Error("Nothing readable was found in the document");
  return JSON.parse(match[0]) as unknown;
}

export async function readIpa(ref: string) {
  const dataUrl = await fetchAsDataUrl(ref);
  const data = await askGateway(
    dataUrl,
    "This is a Singapore MOM In-Principle Approval (IPA) letter or work pass card. " +
      "Return a JSON object with any of these keys you can read: name, fin, passportNumber, " +
      "workPermitNumber, nationality, dateOfBirth, issueDate, expiryDate, occupation.",
  );
  return data as Record<string, string>;
}

export async function readTimeCard(ref: string) {
  const dataUrl = await fetchAsDataUrl(ref);
  const data = await askGateway(
    dataUrl,
    "This is a scanned monthly physical time card. Return a JSON array of rows, one per printed day, " +
      'each like {"date":"YYYY-MM-DD","checkIn":"HH:MM","checkOut":"HH:MM"}. ' +
      "Use 24-hour times. Skip days with no punches. Return [] if the card is unreadable.",
  );
  return Array.isArray(data) ? (data as Record<string, string>[]) : [];
}