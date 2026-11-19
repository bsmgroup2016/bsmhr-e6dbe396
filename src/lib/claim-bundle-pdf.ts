/**
 * Client billing bundle (tax invoice + claim sheet + time card scans) and MOM itemised payslips,
 * drawn with jsPDF to match the company's own documents. Pure drawing: callers pass every value
 * in (images as data URLs), so the layout can be generated and checked outside the browser.
 */
import type { PayslipFigures } from "@/core/payslip-calc";

type Doc = InstanceType<typeof import("jspdf").jsPDF>;
type AutoTable = typeof import("jspdf-autotable").default;
export interface Logo { data: string; format: string; width: number; height: number }

export interface Party {
  name: string;
  address?: string;
  attention?: string;
  phone?: string;
  email?: string;
  website?: string;
  uen?: string;
  bankName?: string;
  bankAccountName?: string;
  bankAccountNo?: string;
  paynow?: string;
}
export interface BundleWorker { code: string; name: string; days: { day: number; g: number | null; ot: number | null }[] }
export interface InvoiceBundle {
  company: Party;
  logo?: Logo | null;
  client: Party;
  invoiceNo: string;
  invoiceDate: string; // YYYY-MM-DD
  dueDays: number;
  month: string; // YYYY-MM
  site: string;
  ratePerHour: number;
  gstRate: number; // percent, e.g. 9
  workers: BundleWorker[];
  /** JPEG/PNG data URLs, one page each, in card order. */
  timeCards: string[];
}

const BLACK: [number, number, number] = [17, 17, 17];
const GREY: [number, number, number] = [110, 110, 110];
const RED: [number, number, number] = [220, 0, 0];
const PINK: [number, number, number] = [252, 228, 214];
const GREEN: [number, number, number] = [183, 225, 162];

const r2 = (n: number) => Math.round(n * 100) / 100;
const money = (n: number) => r2(n).toLocaleString("en-SG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const longDate = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const monthLabel = (month: string) => { const [y, m] = month.split("-").map(Number); return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-SG", { month: "short", year: "numeric", timeZone: "UTC" }).toUpperCase(); };
const daysIn = (month: string) => { const [y, m] = month.split("-").map(Number); return new Date(Date.UTC(y, m, 0)).getUTCDate(); };
const sunday = (month: string, day: number) => { const [y, m] = month.split("-").map(Number); return new Date(Date.UTC(y, m - 1, day)).getUTCDay() === 0; };
const addDays = (iso: string, n: number) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const hoursOf = (w: BundleWorker) => w.days.reduce((t, d) => ({ g: t.g + (d.g ?? 0), ot: t.ot + (d.ot ?? 0) }), { g: 0, ot: 0 });
const fmtHours = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, ""));

async function newDoc(orientation: "portrait" | "landscape" = "portrait") {
  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  return { doc: new jsPDF({ unit: "pt", format: "a4", orientation }), autoTable };
}

export function invoiceTotals(b: Pick<InvoiceBundle, "workers" | "ratePerHour" | "gstRate">) {
  const lines = b.workers.map((w) => { const h = hoursOf(w); const qty = r2(h.g + h.ot); return { worker: w, qty, amount: r2(qty * b.ratePerHour) }; });
  const subtotal = r2(lines.reduce((n, l) => n + l.amount, 0));
  const gst = r2((subtotal * b.gstRate) / 100);
  return { lines, subtotal, gst, total: r2(subtotal + gst) };
}

/* ---------------- tax invoice ---------------- */
function drawInvoice(doc: Doc, autoTable: AutoTable, b: InvoiceBundle) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const L = 40, R = W - 40;
  const { lines, subtotal, gst, total } = invoiceTotals(b);
  const due = addDays(b.invoiceDate, b.dueDays);

  if (b.logo) {
    try {
      const box = 72, ratio = b.logo.width / b.logo.height;
      const w = ratio >= 1 ? box : box * ratio, h = ratio >= 1 ? box / ratio : box;
      doc.addImage(b.logo.data, b.logo.format, L, 28, w, h, undefined, "FAST");
    } catch { /* logo is decoration only */ }
  }

  doc.setTextColor(...BLACK);
  doc.setFont("helvetica", "normal").setFontSize(22).text("TAX INVOICE", L, 160);
  let cy = 185;
  doc.setFontSize(8.5);
  for (const line of [b.client.name, b.client.attention ? `Attention: ${b.client.attention}` : "", ...doc.splitTextToSize(b.client.address ?? "", 170)].filter(Boolean)) { doc.text(line, L + 12, cy); cy += 11; }

  const mx = 222; let my = 140;
  for (const [label, value] of [["Invoice Date", longDate(b.invoiceDate)], ["Invoice Number", b.invoiceNo], ["Reference", b.site]] as const) {
    doc.setFont("helvetica", "bold").setFontSize(8).text(label, mx, my);
    doc.setFont("helvetica", "normal").text(doc.splitTextToSize(value || "-", 105), mx, my + 11);
    my += 34;
  }

  const rx = 360; let ry = 145;
  doc.setFont("helvetica", "bold").setFontSize(10.5).text(b.company.name, rx, ry); ry += 15;
  doc.setFont("helvetica", "normal").setFontSize(9.5);
  for (const line of doc.splitTextToSize(b.company.address ?? "", R - rx)) { doc.text(line, rx, ry); ry += 13; }
  if (b.company.phone) { doc.text(`Tel: ${b.company.phone}`, rx, ry); ry += 13; }
  if (b.company.email) { doc.text(`Email: ${b.company.email}`, rx, ry); ry += 13; }
  doc.setFont("helvetica", "bold");
  if (b.company.website) { doc.text(`Website: ${b.company.website}`, rx, ry); ry += 13; }
  if (b.company.uen) { doc.text(`UEN & GST Reg No. ${b.company.uen}`, rx, ry); ry += 13; }

  const intro = `TO SUBCONTRACTING MAN HOUR WORKS ( ${b.workers.length} Workers )\nClaim for the period ${monthLabel(b.month)}`;
  const label = (w: BundleWorker) => `G/W, ${w.code} ${w.name}`.trim();
  autoTable(doc, {
    startY: Math.max(cy, my, ry) + 30,
    theme: "plain",
    margin: { left: L, right: 40 },
    head: [["Description", "Quantity", "Unit Price", "Tax", "Amount SGD"]],
    body: lines.map((l, i) => [i === 0 ? `${intro}\n${label(l.worker)}` : label(l.worker), money(l.qty), money(b.ratePerHour), `${b.gstRate}%`, money(l.amount)]),
    styles: { fontSize: 8.5, cellPadding: { top: 5, bottom: 5, left: 2, right: 2 }, textColor: BLACK, valign: "middle" },
    headStyles: { fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: 250 }, 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" } },
    didParseCell: (d) => { if (d.section === "head" && d.column.index > 0) d.cell.styles.halign = "right"; },
    didDrawCell: (d) => {
      doc.setDrawColor(d.section === "head" ? 0 : 205).setLineWidth(d.section === "head" ? 1.2 : 0.5);
      doc.line(d.cell.x, d.cell.y + d.cell.height, d.cell.x + d.cell.width, d.cell.y + d.cell.height);
    },
  });

  let y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 16;
  const tl = 350;
  const totalRow = (labelText: string, value: string, bold = false, ruleAbove = false) => {
    if (ruleAbove) { doc.setDrawColor(0).setLineWidth(0.8).line(tl, y - 10, R, y - 10); }
    doc.setFont("helvetica", bold ? "bold" : "normal").setFontSize(8.5);
    doc.text(labelText, R - 120, y, { align: "right" });
    doc.text(value, R, y, { align: "right" });
    y += 18;
  };
  totalRow("Subtotal", money(subtotal));
  totalRow(`Total Local supply of goods and services ${b.gstRate}%`, money(gst));
  totalRow("Invoice Total SGD", money(total), false, true);
  totalRow("Total Net Payments SGD", "0.00");
  totalRow("Amount Due SGD", money(total), true, true);

  // Keep the payment terms and the tear-off advice together on one page.
  if (y > H - 330) { doc.addPage("a4", "portrait"); y = 50; } else y += 16;
  doc.setFont("helvetica", "bold").setFontSize(9).text(`Due Date: ${longDate(due)}`, L, y); y += 13;
  doc.setFontSize(7);
  const para = (text: string) => { const t = doc.splitTextToSize(text, R - L); doc.text(t, L, y); y += t.length * 9 + 6; };
  para("Payment to be made in terms of quotation agreement after the invoice issue date via Bank Transfer by indicating invoice number and forward us a copy of the payment advice:");
  y += 8; doc.text("Note:", L, y); y += 9;
  para("-Please notify us with 7 days, if there is any discrepancy found in this invoice otherwise it will be deemed as accurate and accepted by you for the payment proceedings.");
  y += 6;
  const payee = (b.company.bankAccountName || b.company.name).toUpperCase();
  for (const line of [
    "We appreciate your payment to:",
    `NAME OF ACCOUNT: ${payee}`,
    b.company.bankName ? `NAME OF BANK: ${b.company.bankName.toUpperCase()}` : "",
    b.company.bankAccountNo ? `ACCOUNT NO : ${b.company.bankAccountNo}` : "",
    b.company.paynow ? `PAY NOW ACCOUNT: ${b.company.paynow}` : "",
    `ALL CHEQUE TO BE CROSSED AND MADE PAYABLE TO "${payee}"`,
  ].filter(Boolean)) { doc.text(line, L, y); y += 10; }

  // Payment advice (tear-off)
  y = Math.max(y + 24, H - 260);
  doc.setDrawColor(0).setLineWidth(1).setLineDashPattern([6, 5], 0).line(L - 15, y, R + 15, y).setLineDashPattern([], 0);
  y += 38;
  doc.setFont("helvetica", "normal").setFontSize(20).text("PAYMENT ADVICE", L, y);
  doc.setFontSize(8.5).text("To:", L + 15, y + 22);
  let ay = y + 22;
  for (const line of [b.company.name.toUpperCase(), ...doc.splitTextToSize(b.company.address ?? "", 170)]) { doc.text(line, L + 45, ay); ay += 11; }
  const ax = 330, vx = ax + 85; let by = y - 8;
  for (const [k, v, rule] of [["Customer", b.client.name, false], ["Invoice Number", b.invoiceNo, true], ["Amount Due", money(total), false], ["Due Date", longDate(due), true], ["Amount Enclosed", "", true]] as const) {
    const value = doc.splitTextToSize(v, R - vx) as string[];
    doc.setFont("helvetica", "bold").text(k, ax, by);
    doc.setFont("helvetica", "normal").text(value, vx, by);
    by += (value.length - 1) * 10;
    if (rule) doc.setDrawColor(150).setLineWidth(0.5).line(ax, by + 7, R, by + 7);
    by += 23;
  }
  doc.setDrawColor(0).line(vx, by - 4, R, by - 4);
  doc.setFontSize(7).text("Enter the amount you are paying above", vx, by + 6);
  if (b.company.address) doc.setFontSize(6.5).setTextColor(...GREY).text(`Registered Office: ${b.company.address}`, L, H - 25).setTextColor(...BLACK);
}

/* ---------------- claim sheet ---------------- */
function drawClaimSheet(doc: Doc, autoTable: AutoTable, b: InvoiceBundle) {
  const n = daysIn(b.month);
  const dayCols = Array.from({ length: n }, (_, i) => i + 1);
  const total = 4 + n + 4;
  const { lines, subtotal } = invoiceTotals(b);
  const title = (content: string, size: number) => [{ content, colSpan: total, styles: { halign: "center" as const, fontStyle: "bold" as const, fontSize: size } }];
  const body: unknown[][] = [];
  lines.forEach((l, i) => {
    const h = hoursOf(l.worker);
    const cell = (d: number, k: "g" | "ot") => { const v = l.worker.days.find((x) => x.day === d)?.[k]; return v ? fmtHours(v) : ""; };
    const span = (content: string | number) => ({ content: String(content), rowSpan: 2 });
    body.push([span(i + 1), span(l.worker.code), span(l.worker.name), "G-HRS", ...dayCols.map((d) => cell(d, "g")), fmtHours(h.g), span(fmtHours(r2(h.g + h.ot))), span(money(b.ratePerHour)), span(`$${money(l.amount)}`)]);
    body.push(["OT HOURS", ...dayCols.map((d) => cell(d, "ot")), fmtHours(h.ot)]);
  });
  const allHours = r2(lines.reduce((t, l) => t + l.qty, 0));
  autoTable(doc, {
    startY: 40,
    margin: { left: 30, right: 30 },
    theme: "grid",
    head: [
      title(b.client.name.toUpperCase(), 11),
      title(b.site.toUpperCase(), 10),
      title(`CLAIM FOR ${monthLabel(b.month)}`, 15),
      ["S/N", "STAFF CODE", "NAME", "CATEGORY", ...dayCols.map(String), "TOTAL Hrs", "TOTAL Hrs", "UNIT RATE $/HR", "TOTAL AMOUNT S$"],
    ],
    body: body as never,
    foot: [[{ content: "", colSpan: 4 + n }, fmtHours(allHours), fmtHours(allHours), "TOTAL AMOUNT", `$ ${money(subtotal)}`]],
    styles: { fontSize: 6.5, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.4, textColor: BLACK, halign: "center", valign: "middle" },
    headStyles: { fillColor: [255, 255, 255], textColor: BLACK, fontStyle: "bold" },
    footStyles: { fillColor: [255, 255, 255], textColor: BLACK, fontStyle: "bold" },
    columnStyles: { 1: { cellWidth: 34 }, 2: { cellWidth: 72 }, 3: { cellWidth: 42 } },
    didParseCell: (d) => {
      const col = d.column.index;
      const day = col >= 4 && col < 4 + n ? col - 3 : 0;
      const billing = col >= 4 + n + 1;
      if (d.section === "head" && d.row.index === 3) {
        if (day && sunday(b.month, day)) { d.cell.styles.fillColor = RED; d.cell.styles.textColor = [0, 0, 0]; }
        if (billing) d.cell.styles.fillColor = GREEN;
      }
      if (d.section === "body") {
        const otRow = d.row.index % 2 === 1;
        if (billing) d.cell.styles.fillColor = GREEN;
        else if (otRow && col >= 3) d.cell.styles.fillColor = PINK;
        if (day && sunday(b.month, day)) { d.cell.styles.textColor = RED; d.cell.styles.fontStyle = "bold"; }
      }
      if (d.section === "foot" && col >= 4 + n + 1) d.cell.styles.fillColor = GREEN;
    },
  });
}

/* ---------------- time cards ---------------- */
function drawTimeCards(doc: Doc, images: string[]) {
  images.forEach((data, i) => {
    doc.addPage("a4", "portrait");
    const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
    doc.setFontSize(10).setTextColor(40, 60, 120).text(String(i + 1), W - 50, 45).setTextColor(...BLACK);
    try {
      const props = doc.getImageProperties(data);
      const maxW = W - 120, maxH = H - 130;
      const scale = Math.min(maxW / props.width, maxH / props.height);
      const w = props.width * scale, h = props.height * scale;
      doc.addImage(data, props.fileType, (W - w) / 2, 70, w, h, undefined, "FAST");
    } catch {
      doc.setFontSize(10).text("This time card image could not be added.", 60, 120);
    }
  });
}

export async function buildInvoiceBundle(b: InvoiceBundle): Promise<Doc> {
  if (!b.workers.length) throw new Error("No workers to bill");
  const { doc, autoTable } = await newDoc("portrait");
  drawInvoice(doc, autoTable, b);
  doc.addPage("a4", "landscape");
  drawClaimSheet(doc, autoTable, b);
  drawTimeCards(doc, b.timeCards);
  return doc;
}

/* ---------------- payslips (MOM itemised format) ---------------- */
export interface Payslip {
  employerName: string;
  employerAddress?: string;
  employeeName: string;
  idNo?: string;
  designation?: string;
  month: string;
  paymentDate: string; // YYYY-MM-DD
  paymentMode: string;
  figures: PayslipFigures;
}

function drawPayslip(doc: Doc, p: Payslip) {
  const W = doc.internal.pageSize.getWidth();
  const L = 48, R = W - 48, MID = L + (R - L) * 0.41, OT_MID = L + (R - L) * 0.52;
  const n = daysIn(p.month);
  const [y0, m0] = p.month.split("-");
  const period = `1/${m0}/${y0}  TO  ${n}/${m0}/${y0}`;
  const f = p.figures;
  const amt = (v: number) => (v ? `$  ${money(v)}` : "$          -");
  let y = 52;
  const top = y; // box edges are drawn once the height is known
  doc.setDrawColor(0).setLineWidth(0.8).line(L, top, R, top);
  doc.setTextColor(...BLACK).setFont("helvetica", "normal").setFontSize(11).text("Pay Slip for", L + 50, y + 16);
  doc.setFont("helvetica", "bold").setFontSize(9).text(period, L + 330, y + 16);
  y += 30; doc.line(L, y, R, y);

  const bar = (text: string, right?: string, split = MID) => {
    doc.setFillColor(128, 128, 128).rect(L, y, R - L, 14, "F");
    doc.setTextColor(255, 255, 255).setFont("helvetica", "normal").setFontSize(9).text(text, L + 3, y + 10.5);
    if (right) doc.text(right, split + 3, y + 10.5);
    doc.setTextColor(...BLACK);
    y += 14;
  };
  const text = (t: string, x = L + 3) => { doc.setFont("helvetica", "normal").setFontSize(8).text(t, x, y + 10); y += 14; };
  const row = (label: string, value = "", tag = "", opts: { bold?: boolean; sub?: string; split?: number } = {}) => {
    const split = opts.split ?? MID;
    const h = opts.sub ? 30 : 16;
    doc.setFont("helvetica", opts.bold ? "bold" : "normal").setFontSize(8.5).text(label, L + 3, y + 11);
    if (opts.sub) doc.setFont("helvetica", "normal").setFontSize(8).text(opts.sub, L + 3, y + 25);
    doc.setFont("helvetica", "normal").setFontSize(8.5).text(value, split + 6, y + 11);
    if (tag) doc.text(tag, R - 30, y + 11);
    doc.setDrawColor(0).setLineWidth(0.5).line(split, y, split, y + h).line(L, y + h, R, y + h);
    y += h;
  };

  bar("Name of Employer");
  text(p.employerName);
  if (p.employerAddress) text(p.employerAddress);
  bar("Name & Designation of Employee");
  text(`Name   :        ${p.employeeName}`);
  text(`NRIC / FIN:    ${p.idNo || "-"}${p.designation ? `        Designation: ${p.designation}` : ""}`);
  bar("Item", "Amount ($)");
  row("Basic Pay", `${amt(f.basicPay)}     (${f.workDays} days x $${money(f.dailyRate)})`, "(A)", { bold: true });
  row("Total Allowances", "$          -", "(B)", { bold: true, sub: "(Breakdown shown below)" });
  row("General Allowances");
  row("Transport", "", "(C)");
  row("");
  row("Total Deductions", "$          -", "(D)", { bold: true, sub: "(Breakdown shown below)" });
  row("Employee's CPF deduction:", "$          -");
  row("");
  bar("Date of Payment");
  text(`        ${longDate(p.paymentDate)}`); y += 6;
  bar("Mode of Payment");
  y += 8; doc.setFont("helvetica", "bold").setFontSize(9).text(p.paymentMode, L + 3, y + 10); y += 22;
  bar("Overtime Details*");
  row("Overtime Payment Period(S)", period, "", { bold: true, split: OT_MID });
  row("OverTime Hours Worked", `${fmtHours(f.otHours)} Hrs  (x $${f.hourlyOtRate.toLocaleString("en-SG", { minimumFractionDigits: 2, maximumFractionDigits: 3 })})`, "", { bold: true, split: OT_MID });
  row("Total Overtime Pay", amt(f.otPay), "(E)", { bold: true, split: OT_MID });
  row("", "", "", { split: OT_MID });
  bar("Item", "Amount ($)", OT_MID);
  row("Other Additional Payments", f.restDayPay ? amt(f.restDayPay) : "NA", "(F)", { bold: true, sub: "(Breakdown shown below)", split: OT_MID });
  row(f.restDays ? `Rest day pay (${f.restDays} Sunday x $${money(f.dailyRate)} x 1.5)` : "", f.restDays ? amt(f.restDayPay) : "", "", { split: OT_MID });
  row("", "", "", { split: OT_MID });
  row("", "", "", { split: OT_MID });
  row("Net Pay (A+B+C-D+E+F)", amt(f.netPay), "", { bold: true, split: OT_MID });
  row("Employer's CPF Contributions", "$          -", "", { bold: true, split: OT_MID });
  y += 50;
  doc.setFont("helvetica", "normal").setFontSize(8).text("This document is generated electronically; no signature is required.", L + 3, y);
  y += 6;
  doc.setDrawColor(0).setLineWidth(0.8).line(L, top, L, y).line(R, top, R, y).line(L, y, R, y);
  if (f.otOverLimit > 0) {
    doc.setTextColor(...RED).setFontSize(7).text(`* Overtime above 72 hours in the month (${fmtHours(f.otOverLimit)} hrs) needs an MOM overtime exemption.`, L, y + 14).setTextColor(...BLACK);
  }
}

export async function buildPayslips(slips: Payslip[]): Promise<Doc> {
  if (!slips.length) throw new Error("No payslips to generate");
  const { doc } = await newDoc("portrait");
  slips.forEach((p, i) => { if (i) doc.addPage("a4", "portrait"); drawPayslip(doc, p); });
  return doc;
}
