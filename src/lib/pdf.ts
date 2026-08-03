/**
 * Client-side PDF generation for invoices, payslips and claim sheets.
 * jsPDF + autotable are loaded lazily so they never enter the initial bundle.
 */
import type { ClaimSheet, Employee, Invoice, PayrollEntry, Quotation } from "./types";

const BRAND: [number, number, number] = [37, 99, 235];
const MUTED: [number, number, number] = [107, 114, 128];

function money(n: number) {
  return `$ ${(Math.round(n * 100) / 100).toLocaleString("en-SG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

async function newDoc() {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  return { doc: doc as any, autoTable };
}

/** Fetch an R2-stored logo and return a jsPDF-friendly data URL. */
async function loadLogo(ref?: string): Promise<{ data: string; format: string } | null> {
  if (!ref) return null;
  try {
    const { getSignedUrl } = await import("./r2");
    const url = await getSignedUrl(ref);
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const data = await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = () => reject(new Error("read failed"));
      fr.readAsDataURL(blob);
    });
    const format = blob.type.includes("png") ? "PNG" : blob.type.includes("webp") ? "WEBP" : "JPEG";
    return { data, format };
  } catch {
    return null;
  }
}

function header(
  doc: any,
  title: string,
  company: { name?: string; uen?: string; address?: string } | undefined,
  right: string[],
  logo?: { data: string; format: string } | null,
) {
  doc.setFillColor(BRAND[0], BRAND[1], BRAND[2]);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 6, "F");
  let textX = 40;
  if (logo) {
    try {
      doc.addImage(logo.data, logo.format, 40, 26, 56, 56, undefined, "FAST");
      textX = 108;
    } catch {
      textX = 40;
    }
  }
  doc.setFontSize(18);
  doc.setTextColor(17, 24, 39);
  doc.text(title, textX, 52);
  doc.setFontSize(10);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  let y = logo ? 96 : 76;
  const left = [company?.name, company?.uen ? `UEN: ${company.uen}` : "", company?.address].filter(
    Boolean,
  ) as string[];
  for (const line of left) {
    doc.text(line, 40, y, { maxWidth: doc.internal.pageSize.getWidth() - 240 });
    y += 14;
  }
  const rx = doc.internal.pageSize.getWidth() - 40;
  let ry = 76;
  for (const line of right) {
    doc.text(line, rx, ry, { align: "right" });
    ry += 14;
  }
  return Math.max(y, ry) + 10;
}

function totals(doc: any, startY: number, rows: [string, string, boolean?][]) {
  const rx = doc.internal.pageSize.getWidth() - 40;
  let y = startY;
  for (const [label, value, bold] of rows) {
    doc.setFontSize(bold ? 12 : 10);
    if (bold) doc.setTextColor(17, 24, 39);
    else doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(label, rx - 170, y);
    doc.text(value, rx, y, { align: "right" });
    y += bold ? 20 : 16;
  }
  return y;
}

function footer(doc: any, note?: string) {
  const h = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  if (note) doc.text(note, 40, h - 46, { maxWidth: doc.internal.pageSize.getWidth() - 80 });
  doc.text(`Generated ${new Date().toLocaleString("en-SG")}`, 40, h - 30);
}

export async function downloadInvoicePdf(
  invoice: Invoice,
  opts: { company?: { name?: string; uen?: string; address?: string }; clientName?: string },
) {
  const { doc, autoTable } = await newDoc();
  const y = header(doc, "TAX INVOICE", opts.company, [
    invoice.invoiceNo,
    `Issue: ${invoice.issueDate}`,
    `Due: ${invoice.dueDate}`,
  ]);
  doc.setFontSize(10);
  doc.setTextColor(17, 24, 39);
  doc.text(`Bill to: ${opts.clientName ?? "-"}`, 40, y + 6);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(`Period: ${invoice.periodStart} to ${invoice.periodEnd}`, 40, y + 20);
  autoTable(doc, {
    startY: y + 36,
    head: [["Description", "Qty", "Rate", "OT hrs", "OT rate", "Amount"]],
    body: invoice.lines.map((l) => [
      l.description,
      `${l.quantity} ${l.unit === "Hourly" ? "hr" : l.unit === "Daily" ? "day" : "mth"}`,
      money(l.rate),
      String(l.otQuantity ?? 0),
      l.otRate ? money(l.otRate) : "-",
      money(l.amount),
    ]),
    styles: { fontSize: 9, cellPadding: 6 },
    headStyles: { fillColor: BRAND, textColor: 255 },
    columnStyles: {
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right" },
    },
  });
  const after = doc.lastAutoTable.finalY + 26;
  totals(doc, after, [
    ["Subtotal", money(invoice.subtotal)],
    [`GST ${invoice.gstRate}%`, money(invoice.gstAmount)],
    ["Total", money(invoice.total), true],
    ["Paid", money(invoice.amountPaid)],
    ["Balance due", money(invoice.total - invoice.amountPaid), true],
  ]);
  footer(doc, invoice.notes);
  doc.save(`invoice_${invoice.invoiceNo}.pdf`);
}

export async function downloadPayslipPdf(
  entry: PayrollEntry,
  opts: { employee?: Employee; companyName?: string },
) {
  const { doc, autoTable } = await newDoc();
  const y = header(doc, "PAYSLIP", { name: opts.companyName }, [
    `Month: ${entry.month}`,
    `Status: ${entry.status}`,
  ]);
  doc.setFontSize(12);
  doc.setTextColor(17, 24, 39);
  doc.text(opts.employee?.name ?? "-", 40, y + 8);
  doc.setFontSize(9);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(
    [opts.employee?.employeeCode, opts.employee?.trade, opts.employee?.passType]
      .filter(Boolean)
      .join("  -  "),
    40,
    y + 24,
  );
  const bodyRows: string[][] = [
    ["Basic salary", money(entry.basicSalary)],
    ["Overtime", money(entry.overtimePay)],
    ["Allowances", money(entry.allowances)],
    ["Deductions", `- ${money(entry.deductions)}`],
    ["CPF (employee)", `- ${money(entry.cpfEmployee)}`],
  ];
  if (entry.shgAmount) {
    bodyRows.push([`${entry.shgFund ?? "SHG"} fund`, `- ${money(entry.shgAmount)}`]);
  }
  autoTable(doc, {
    startY: y + 40,
    head: [["Item", "Amount"]],
    body: bodyRows,
    styles: { fontSize: 10, cellPadding: 7 },
    headStyles: { fillColor: BRAND, textColor: 255 },
    columnStyles: { 1: { halign: "right" } },
  });
  const after = doc.lastAutoTable.finalY + 26;
  const end = totals(doc, after, [
    ["Net pay", money(entry.netPay), true],
    ["Employer CPF", money(entry.cpfEmployer)],
    ["SDL", money(entry.sdl ?? 0)],
    ["Levy", money(entry.levies)],
  ]);
  doc.setFontSize(8);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text("This is a computer generated payslip and does not require a signature.", 40, end + 12);
  footer(doc);
  doc.save(`payslip_${opts.employee?.employeeCode ?? entry.employeeId}_${entry.month}.pdf`);
}

export async function downloadClaimSheetPdf(
  sheet: ClaimSheet,
  opts: { employeeName?: string; companyName?: string },
) {
  const { doc, autoTable } = await newDoc();
  const y = header(doc, "CLAIM SHEET", { name: opts.companyName }, [
    sheet.reference,
    `Period: ${sheet.periodStart} to ${sheet.periodEnd}`,
  ]);
  doc.setFontSize(12);
  doc.setTextColor(17, 24, 39);
  doc.text(opts.employeeName ?? "-", 40, y + 8);
  autoTable(doc, {
    startY: y + 26,
    head: [["Date", "Check in", "Check out", "Normal hrs", "OT hrs", "Status", "Site"]],
    body: sheet.snapshot.map((r) => [
      r.date,
      r.checkIn ?? "-",
      r.checkOut ?? "-",
      String(r.normalHours ?? 0),
      String(r.otHours ?? 0),
      r.status,
      r.site ?? "-",
    ]),
    styles: { fontSize: 9, cellPadding: 5 },
    headStyles: { fillColor: BRAND, textColor: 255 },
    columnStyles: { 3: { halign: "right" }, 4: { halign: "right" } },
  });
  const after = doc.lastAutoTable.finalY + 26;
  const end = totals(doc, after, [
    ["Total days", String(sheet.totalDays)],
    ["Normal hours", String(sheet.totalNormalHours)],
    ["OT hours", String(sheet.totalOtHours), true],
  ]);
  doc.setFontSize(9);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text("Worker signature: ______________________", 40, end + 34);
  doc.text("Supervisor signature: ______________________", 300, end + 34);
  footer(doc);
  doc.save(`claim_sheet_${sheet.reference}.pdf`);
}
/** Client-facing quotation PDF — works for both existing clients and prospects. */
export async function downloadQuotationPdf(
  quote: Quotation,
  opts: {
    company?: {
      name?: string;
      uen?: string;
      address?: string;
      phone?: string;
      email?: string;
      logoUrl?: string;
    };
    clientName?: string;
    projectName?: string;
  },
) {
  const { doc, autoTable } = await newDoc();
  const logo = await loadLogo(opts.company?.logoUrl);
  const y = header(
    doc,
    "QUOTATION",
    opts.company,
    [
      quote.quoteNo,
      `Date: ${quote.quoteDate || "-"}`,
      quote.validUntil ? `Valid until: ${quote.validUntil}` : "",
    ].filter(Boolean) as string[],
    logo,
  );

  const to = [
    opts.clientName ?? quote.prospectCompany ?? "-",
    quote.contactPerson ?? quote.prospectContact ?? "",
    quote.prospectAddress ?? "",
    quote.prospectEmail ?? "",
    quote.prospectPhone ?? "",
  ].filter(Boolean) as string[];

  doc.setFontSize(10);
  doc.setTextColor(17, 24, 39);
  doc.text("Quotation to", 40, y + 6);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  let ty = y + 20;
  for (const line of to) {
    doc.text(line, 40, ty);
    ty += 13;
  }
  doc.setTextColor(17, 24, 39);
  doc.text(quote.title || "Manpower supply quotation", 40, ty + 6, {
    maxWidth: doc.internal.pageSize.getWidth() - 80,
  });
  if (opts.projectName) {
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(`Project / site: ${opts.projectName}`, 40, ty + 20);
  }

  const unitLabel = (u: string) => (u === "Hourly" ? "hr" : u === "Daily" ? "day" : "mth");
  autoTable(doc, {
    startY: ty + (opts.projectName ? 34 : 20),
    head: [["Designation", "Pax", "Rate", "OT rate", "Units", "Amount"]],
    body: quote.lines.map((l) => [
      l.designation + (l.description ? `\n${l.description}` : ""),
      String(l.headcount),
      `${money(l.normalRate)}/${unitLabel(l.unit)}`,
      `${money(l.otRate)}/${unitLabel(l.unit)}`,
      String(l.unitsPerPeriod),
      money(l.amount),
    ]),
    styles: { fontSize: 9, cellPadding: 6 },
    headStyles: { fillColor: BRAND, textColor: 255 },
    columnStyles: {
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right" },
    },
  });

  const after = doc.lastAutoTable.finalY + 26;
  const rows: [string, string, boolean?][] = [["Subtotal", money(quote.subtotal)]];
  if (quote.discount) rows.push(["Discount", `- ${money(quote.discount)}`]);
  rows.push([`GST ${quote.gstRate}%`, money(quote.gstAmount)]);
  rows.push(["Total", money(quote.total), true]);
  let endY = totals(doc, after, rows);

  doc.setFontSize(9);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(`Payment terms: ${quote.paymentTermsDays} days from invoice date`, 40, endY + 4);
  if (quote.terms) {
    endY += 22;
    doc.setTextColor(17, 24, 39);
    doc.text("Terms & conditions", 40, endY);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.setFontSize(8);
    doc.text(quote.terms, 40, endY + 14, { maxWidth: doc.internal.pageSize.getWidth() - 80 });
  }

  footer(doc, "This quotation is computer generated and valid without signature.");
  doc.save(`quotation_${quote.quoteNo}.pdf`);
}
