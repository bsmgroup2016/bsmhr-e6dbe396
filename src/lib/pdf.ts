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

function header(
  doc: any,
  title: string,
  company: { name?: string; uen?: string; address?: string } | undefined,
  right: string[],
) {
  doc.setFillColor(BRAND[0], BRAND[1], BRAND[2]);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 6, "F");
  doc.setFontSize(18);
  doc.setTextColor(17, 24, 39);
  doc.text(title, 40, 52);
  doc.setFontSize(10);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  let y = 76;
  const left = [company?.name, company?.uen ? `UEN: ${company.uen}` : "", company?.address].filter(
    Boolean,
  ) as string[];
  for (const line of left) {
    doc.text(line, 40, y);
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