/** Export-step outputs that ride along with the claim sheet: payslips and the client billing bundle. */
import { payslipFigures } from "@/core/payslip-calc";
import { matchCardWorker } from "@/core/time-card-matching";
import { buildInvoiceBundle, buildPayslips, type Payslip } from "@/lib/claim-bundle-pdf";
import { loadDefaultLogo, loadLogo } from "@/lib/pdf";
import { getClients, getCompanies, getCurrentCompany, getEmployees } from "@/lib/store";
import type { ClaimDetails, Worker } from "./types";

/** Billing rate per claimed hour (G + OT) until the rate source is decided. */
export const DEFAULT_RATE_PER_HOUR = 10;
export const GST_PERCENT = 9;
const DUE_DAYS = 30;

const monthLabel = (month: string) => { const [y, m] = month.split("-").map(Number); return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-SG", { month: "short", year: "numeric", timeZone: "UTC" }).toUpperCase(); };
const currentCompany = () => getCompanies().find((c) => c.id === getCurrentCompany()) ?? getCompanies()[0];

export function suggestInvoiceNo(month: string) {
  const code = (currentCompany()?.code || "INV").toUpperCase();
  return `${code}-INV-${month.replace("-", "")}01`;
}

/** Pay date: the 7th of the month after the claim month, as on the existing payslips. */
function paymentDate(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 7)).toISOString().slice(0, 10);
}

export async function downloadPayslips(workers: Worker[], month: string) {
  const [y, m] = month.split("-").map(Number);
  const employees = getEmployees();
  const companies = getCompanies();
  const fallback = currentCompany();
  const missing: string[] = [];
  const overLimit: string[] = [];
  const slips: Payslip[] = [];
  for (const w of workers) {
    const emp = employees.find((e) => e.id === matchCardWorker(employees, { workerName: w.name, employeeCode: w.code }));
    const label = `${w.code} ${w.name}`.trim();
    if (!emp) { missing.push(`${label} (not linked to a worker)`); continue; }
    if (!(emp.basicSalary > 0)) { missing.push(`${label} (no daily rate)`); continue; }
    const figures = payslipFigures(w.days.map((d) => ({ day: d.day, g: d.g, ot: d.ot, worked: d.status === "work" })), emp.basicSalary, y, m);
    if (figures.otOverLimit > 0) overLimit.push(`${label}: ${figures.otHours} OT hrs`);
    const employer = companies.find((c) => c.id === emp.companyId) ?? fallback;
    slips.push({
      employerName: employer?.legalName || employer?.name || "",
      employerAddress: employer?.address,
      employeeName: emp.name,
      idNo: emp.fin,
      designation: emp.trade,
      month,
      paymentDate: paymentDate(month),
      paymentMode: emp.paymentMethod ?? "Cash / Cheque / Bank Deposit",
      figures,
    });
  }
  if (!slips.length) throw new Error(`No payslips: ${missing.join("; ") || "no workers"}`);
  const doc = await buildPayslips(slips);
  doc.save(`PAYSLIPS ${monthLabel(month)}.pdf`);
  return { count: slips.length, missing, overLimit };
}

/** Time-card previews (object URLs) → JPEG data URLs that jsPDF can embed; one per scanned page. */
async function cardImages(workers: Worker[]) {
  const urls = [...new Set(workers.map((w) => w.preview).filter(Boolean))];
  const out: string[] = [];
  for (const url of urls) {
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      out.push(canvas.toDataURL("image/jpeg", 0.85));
    } catch { /* a card that cannot be drawn is left out; the invoice and claim still go out */ }
  }
  return out;
}

export async function downloadInvoiceBundle(workers: Worker[], details: ClaimDetails, opts: { invoiceNo: string; ratePerHour: number }) {
  if (!opts.invoiceNo.trim()) throw new Error("Enter the invoice number");
  if (!(opts.ratePerHour > 0)) throw new Error("Enter the rate per hour");
  const company = currentCompany();
  if (!company) throw new Error("Choose a company first");
  const clientName = details.client.trim();
  const client = getClients().find((c) => c.name.trim().toLowerCase() === clientName.toLowerCase());
  const logo = (await loadLogo(company.logoUrl)) ?? (await loadDefaultLogo());
  const doc = await buildInvoiceBundle({
    company: {
      name: company.legalName || company.name,
      address: company.address,
      phone: company.phone,
      email: company.email,
      uen: company.uen,
      bankName: company.bankName,
      bankAccountName: company.bankAccountName,
      bankAccountNo: company.bankAccountNo,
      paynow: company.paynowUen || company.uen,
    },
    logo,
    client: { name: client?.name || clientName || "Client", address: client?.address, attention: client?.contactPerson },
    invoiceNo: opts.invoiceNo.trim(),
    invoiceDate: new Date().toISOString().slice(0, 10),
    dueDays: DUE_DAYS,
    month: details.month,
    site: details.site,
    ratePerHour: opts.ratePerHour,
    gstRate: GST_PERCENT,
    workers: [...workers]
      .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))
      .map((w) => ({ code: w.code, name: w.name, days: w.days.filter((d) => d.status === "work").map((d) => ({ day: d.day, g: d.g, ot: d.ot })) })),
    timeCards: await cardImages(workers),
  });
  doc.save(`${opts.invoiceNo.trim()} - ${monthLabel(details.month)}.pdf`);
}
