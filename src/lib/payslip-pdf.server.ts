/**
 * Server-side payslip PDF.
 *
 * The mobile apps cannot run the browser jsPDF path, so the same payslip is
 * rendered here and returned as bytes from `/api/public/v1/payroll/:id/payslip`.
 * Pure data in, Uint8Array out — no DOM, no logo fetch (keeps it Worker-safe).
 */

export interface PayslipData {
  month: string;
  employee: {
    name: string;
    pFileNo?: string | null;
    fin?: string | null;
    designation?: string | null;
    passType?: string | null;
    bankAccountNo?: string | null;
  };
  company: { name?: string | null; uen?: string | null; address?: string | null };
  basicSalary: number;
  overtimePay: number;
  overtimeHours: number;
  allowances: number;
  cpfEmployee: number;
  accommodationDeduction: number;
  loanRepayment: number;
  otherDeductions: number;
  deductions: number;
  shgFund?: string | null;
  shgAmount: number;
  netPay: number;
  status?: string | null;
  paidAt?: string | null;
}

const money = (n: number) =>
  `$ ${(Math.round((Number(n) || 0) * 100) / 100).toFixed(2)}`;

export async function buildPayslipPdf(d: PayslipData): Promise<Uint8Array> {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const doc = new jsPDF({ unit: "pt", format: "a4" }) as any;

  doc.setFillColor(37, 99, 235);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 6, "F");

  doc.setFontSize(18);
  doc.setTextColor(17, 24, 39);
  doc.text("Payslip", 40, 50);

  doc.setFontSize(10);
  doc.setTextColor(107, 114, 128);
  const left = [d.company.name, d.company.uen ? `UEN: ${d.company.uen}` : "", d.company.address]
    .filter(Boolean)
    .join("\n");
  doc.text(left || "", 40, 70);
  doc.text(`Pay period: ${d.month}`, 400, 70);
  if (d.status) doc.text(`Status: ${d.status}`, 400, 84);
  if (d.paidAt) doc.text(`Paid on: ${String(d.paidAt).slice(0, 10)}`, 400, 98);

  autoTable(doc, {
    startY: 130,
    theme: "plain",
    styles: { fontSize: 10 },
    body: [
      ["Employee", d.employee.name],
      ["P-File No.", d.employee.pFileNo ?? "-"],
      ["FIN / NRIC", d.employee.fin ?? "-"],
      ["Designation", d.employee.designation ?? "-"],
      ["Pass type", d.employee.passType ?? "-"],
      ["Bank account", d.employee.bankAccountNo ?? "-"],
    ],
  });

  autoTable(doc, {
    startY: (doc.lastAutoTable?.finalY ?? 200) + 18,
    head: [["Earnings", "Amount"]],
    headStyles: { fillColor: [37, 99, 235] },
    styles: { fontSize: 10 },
    body: [
      ["Basic salary", money(d.basicSalary)],
      [`Overtime (${d.overtimeHours} h)`, money(d.overtimePay)],
      ["Allowances", money(d.allowances)],
      ["Gross pay", money(d.basicSalary + d.overtimePay + d.allowances)],
    ],
  });

  autoTable(doc, {
    startY: (doc.lastAutoTable?.finalY ?? 300) + 14,
    head: [["Deductions", "Amount"]],
    headStyles: { fillColor: [107, 114, 128] },
    styles: { fontSize: 10 },
    body: [
      ["CPF (employee)", money(d.cpfEmployee)],
      [`SHG${d.shgFund && d.shgFund !== "None" ? ` — ${d.shgFund}` : ""}`, money(d.shgAmount)],
      ["Accommodation", money(d.accommodationDeduction)],
      ["Loan repayment", money(d.loanRepayment)],
      ["Other deductions", money(d.otherDeductions)],
      ["Total deductions", money(d.deductions)],
    ],
  });

  const y = (doc.lastAutoTable?.finalY ?? 400) + 30;
  doc.setFontSize(13);
  doc.setTextColor(17, 24, 39);
  doc.text(`Net pay: ${money(d.netPay)}`, 40, y);
  doc.setFontSize(8);
  doc.setTextColor(107, 114, 128);
  doc.text(
    "Computer-generated payslip issued under the Employment Act (Singapore). Keep for your records.",
    40,
    y + 24,
  );

  return new Uint8Array(doc.output("arraybuffer") as ArrayBuffer);
}
