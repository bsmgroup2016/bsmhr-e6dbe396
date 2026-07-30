/**
 * Employment Act (Singapore) salary deduction compliance.
 *
 * Statutory limits enforced here:
 *  - s.32: total authorised deductions in any salary period may not exceed
 *    50% of the salary payable for that period (CPF and income tax excluded).
 *  - Accommodation, amenities and services deductions may not exceed 25%.
 *  - Loan / advance recovery may not exceed 25% of monthly salary.
 *  - Deductions for accommodation/amenities require the employee's written
 *    consent, which may be withdrawn at any time.
 */
import type { Employee, PayrollEntry } from "./types";

export const TOTAL_DEDUCTION_CAP = 0.5;
export const ACCOMMODATION_CAP = 0.25;
export const LOAN_CAP = 0.25;

export type DeductionSeverity = "ok" | "warning" | "critical";

export interface DeductionRow {
  payrollId: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  month: string;
  /** Salary payable before deductions (basic + OT + allowances). */
  grossSalary: number;
  accommodation: number;
  loanRepayment: number;
  other: number;
  /** Total authorised deductions, excluding CPF. */
  total: number;
  totalPct: number;
  accommodationPct: number;
  loanPct: number;
  consent: boolean;
  issues: string[];
  severity: DeductionSeverity;
}

const pct = (part: number, whole: number) => (whole > 0 ? part / whole : 0);

export function deductionRows(
  employees: Employee[],
  payroll: PayrollEntry[],
  month?: string,
): DeductionRow[] {
  const byId = new Map(employees.map((e) => [e.id, e]));

  return payroll
    .filter((p) => (month ? p.month === month : true))
    .filter((p) => byId.has(p.employeeId))
    .map((p) => {
      const employee = byId.get(p.employeeId)!;
      const gross = (p.basicSalary ?? 0) + (p.overtimePay ?? 0) + (p.allowances ?? 0);
      const accommodation = p.accommodationDeduction ?? 0;
      const loan = p.loanRepayment ?? 0;
      const other = p.otherDeductions ?? Math.max(0, (p.deductions ?? 0) - accommodation - loan);
      const total = accommodation + loan + other;

      const totalPct = pct(total, gross);
      const accommodationPct = pct(accommodation, gross);
      const loanPct = pct(loan, gross);

      const issues: string[] = [];
      if (totalPct > TOTAL_DEDUCTION_CAP) {
        issues.push(`Total deductions ${Math.round(totalPct * 100)}% exceed the 50% cap`);
      }
      if (accommodationPct > ACCOMMODATION_CAP) {
        issues.push(`Accommodation ${Math.round(accommodationPct * 100)}% exceeds the 25% cap`);
      }
      if (loanPct > LOAN_CAP) {
        issues.push(`Loan recovery ${Math.round(loanPct * 100)}% exceeds the 25% cap`);
      }
      if (accommodation > 0 && !(p.deductionConsent ?? false)) {
        issues.push("Written consent not recorded for accommodation deduction");
      }
      if (gross <= 0 && total > 0) {
        issues.push("Deductions recorded without any salary payable");
      }

      const severity: DeductionSeverity = issues.some((i) => i.includes("cap") || i.includes("without"))
        ? "critical"
        : issues.length > 0
          ? "warning"
          : "ok";

      return {
        payrollId: p.id,
        employeeId: p.employeeId,
        employeeName: employee.name ?? employee.id,
        employeeCode: employee.employeeCode ?? "—",
        month: p.month,
        grossSalary: gross,
        accommodation,
        loanRepayment: loan,
        other,
        total,
        totalPct,
        accommodationPct,
        loanPct,
        consent: p.deductionConsent ?? false,
        issues,
        severity,
      };
    })
    .sort((a, b) => b.totalPct - a.totalPct);
}

export interface DeductionSummary {
  records: number;
  breaches: number;
  missingConsent: number;
  totalDeducted: number;
  totalLoanRecovered: number;
}

export function deductionSummary(rows: DeductionRow[]): DeductionSummary {
  return {
    records: rows.length,
    breaches: rows.filter((r) => r.severity === "critical").length,
    missingConsent: rows.filter((r) => !r.consent && r.accommodation > 0).length,
    totalDeducted: rows.reduce((s, r) => s + r.total, 0),
    totalLoanRecovered: rows.reduce((s, r) => s + r.loanRepayment, 0),
  };
}

/** Maximum amount that may still be deducted this month without breaching caps. */
export function remainingDeductionRoom(row: DeductionRow): number {
  return Math.max(0, row.grossSalary * TOTAL_DEDUCTION_CAP - row.total);
}
