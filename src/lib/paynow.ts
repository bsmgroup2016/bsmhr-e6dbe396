/**
 * PayNow (SGQR / EMVCo) QR payload builder — lets clients scan and pay an
 * invoice from any Singapore banking app. No payment gateway involved.
 */
import type { Company } from "./types";

function field(id: string, value: string) {
  return `${id}${String(value.length).padStart(2, "0")}${value}`;
}

function crc16(input: string) {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i++) {
    crc ^= input.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export interface PayNowTarget {
  proxyType: "UEN" | "Mobile";
  proxyValue: string;
  merchantName: string;
  amount?: number;
  reference?: string;
  editableAmount?: boolean;
  expiryDate?: string; // YYYYMMDD
}

/** Build the raw EMVCo string encoded inside a PayNow QR code. */
export function buildPayNowPayload(t: PayNowTarget): string {
  const proxy =
    t.proxyType === "Mobile"
      ? t.proxyValue.replace(/\s/g, "").startsWith("+")
        ? t.proxyValue.replace(/\s/g, "")
        : `+65${t.proxyValue.replace(/\D/g, "").slice(-8)}`
      : t.proxyValue.replace(/\s/g, "").toUpperCase();

  const merchant =
    field("00", "SG.PAYNOW") +
    field("01", t.proxyType === "Mobile" ? "0" : "2") +
    field("02", proxy) +
    field("03", t.editableAmount ? "1" : "0") +
    (t.expiryDate ? field("04", t.expiryDate) : "");

  let payload =
    field("00", "01") +
    field("01", t.amount && !t.editableAmount ? "12" : "11") +
    field("26", merchant) +
    field("52", "0000") +
    field("53", "702") +
    (t.amount ? field("54", t.amount.toFixed(2)) : "") +
    field("58", "SG") +
    field("59", (t.merchantName || "NA").slice(0, 25)) +
    field("60", "Singapore") +
    (t.reference ? field("62", field("01", t.reference.slice(0, 25))) : "");

  payload += "6304";
  return payload + crc16(payload);
}

/** Whether a company has usable PayNow details configured. */
export function payNowConfigured(company?: Partial<Company>): boolean {
  if (!company) return false;
  return company.paynowType === "Mobile" ? !!company.paynowPhone : !!company.paynowUen;
}

/** Render a PayNow QR as a PNG data URL (used in the UI and in invoice PDFs). */
export async function payNowQrDataUrl(
  company: Partial<Company>,
  opts: { amount?: number; reference?: string; width?: number } = {},
): Promise<string | null> {
  if (!payNowConfigured(company)) return null;
  const payload = buildPayNowPayload({
    proxyType: company.paynowType === "Mobile" ? "Mobile" : "UEN",
    proxyValue: (company.paynowType === "Mobile" ? company.paynowPhone : company.paynowUen) ?? "",
    merchantName: company.legalName || company.name || "NA",
    amount: opts.amount && opts.amount > 0 ? opts.amount : undefined,
    reference: opts.reference,
    editableAmount: company.paynowEditable,
  });
  try {
    const QR = await import("qrcode");
    return await QR.toDataURL(payload, { margin: 1, width: opts.width ?? 320 });
  } catch (e) {
    console.error("PayNow QR could not be generated", e);
    return null;
  }
}

/** Human-readable bank transfer lines for documents and the UI. */
export function bankTransferLines(company?: Partial<Company>): string[] {
  if (!company) return [];
  return [
    company.bankName ? `Bank: ${company.bankName}` : "",
    company.bankAccountName ? `Account name: ${company.bankAccountName}` : "",
    company.bankAccountNo ? `Account no: ${company.bankAccountNo}` : "",
    company.bankCode ? `Bank / branch code: ${company.bankCode}` : "",
    company.bankSwift ? `SWIFT: ${company.bankSwift}` : "",
  ].filter(Boolean) as string[];
}
