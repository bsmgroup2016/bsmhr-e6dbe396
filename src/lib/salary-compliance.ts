/**
 * Singapore salary compliance (Employment Act + EFMA / FWMI).
 *
 * Checks each payroll month against the statutory rules that MOM audits most
 * often for manpower-supply firms:
 *  - salary paid within 7 days of the end of the salary period (EA s21)
 *  - overtime paid within 14 days of the period end, and capped at 72 h/month
 *  - itemised payslip issued within 3 working days of payment (EA s96)
 *  - salary actually paid must not fall below the salary declared to MOM
 *    on the Work Permit / IPA (EFMA)
 *  - foreign workers must be paid electronically (bank/GIRO/PayNow)
 *  - Key Employment Terms issued in writing within 14 days of starting work
 */
import type { Employee, PayrollEntry } from "@/lib/types";

/** Maximum overtime hours allowed in one month. */
export const OT_MONTHLY_CAP = 72;
/** Days after the salary period ends to pay salary. */
export const SALARY_PAY_WINDOW_DAYS = 7;
/** Days after the salary period ends to pay overtime. */
export const OT_PAY_WINDOW_DAYS = 14;
/** Days after starting work to issue Key Employment Terms. */
export const KET_WINDOW_DAYS = 14;

export type IssueSeverity = "critical" | "warning";

export interface SalaryIssue {
  code: "late-salary" | "late-ot" | "ot-cap" | "no-payslip" | "underpaid" | "cash-payment" | "no-ket";
  label: string;
  detail: string;
  severity: IssueSeverity;
}

export interface SalaryComplianceRow {
  id: string;
  employee: Employee;
  entry: PayrollEntry;
  /** Last calendar day of the salary period. */
  periodEnd: string;
  /** Salary declared to MOM, when recorded. */
  declared: number;
  /** Basic + fixed allowances actually paid. */
  paid: number;
  paidOnDay: number | null;
  issues: SalaryIssue[];
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Last day of a YYYY-MM month. */
export function monthEnd(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return iso(new Date(Date.UTC(y, m, 0)));
}

const daysBetween = (from: string, to: string) =>
  Math.round(
    (new Date(`${to.slice(0, 10)}T00:00:00Z`).getTime() -
      new Date(`${from.slice(0, 10)}T00:00:00Z`).getTime()) / 86400000,
  );

const money = (n: number) => `$${n.toLocaleString("en-SG", { maximumFractionDigits: 2 })}`;

const isForeign = (e: Employee) => e.passType !== "Singaporean/PR";

/** Evaluate one payroll entry against the salary rules. */
export function evaluateEntry(
  employee: Employee,
  entry: PayrollEntry,
  today = iso(new Date()),
): SalaryComplianceRow {
  const periodEnd = monthEnd(entry.month);
  const issues: SalaryIssue[] = [];

  const paidDate = entry.paidAt ? entry.paidAt.slice(0, 10) : null;
  const paidOnDay = paidDate ? daysBetween(periodEnd, paidDate) : null;
  const elapsed = daysBetween(periodEnd, today);

  // 1. Salary paid within 7 days
  if (paidDate) {
    if (paidOnDay! > SALARY_PAY_WINDOW_DAYS) {
      issues.push({
        code: "late-salary",
        label: "Salary paid late",
        detail: `Paid ${paidOnDay} days after ${periodEnd} (limit ${SALARY_PAY_WINDOW_DAYS} days).`,
        severity: "critical",
      });
    }
  } else if (elapsed > SALARY_PAY_WINDOW_DAYS && entry.status !== "Draft") {
    issues.push({
      code: "late-salary",
      label: "Salary unpaid past deadline",
      detail: `${elapsed} days since ${periodEnd} with no payment date recorded.`,
      severity: "critical",
    });
  }

  // 2. Overtime paid within 14 days
  if ((entry.overtimePay ?? 0) > 0) {
    if (paidOnDay != null && paidOnDay > OT_PAY_WINDOW_DAYS) {
      issues.push({
        code: "late-ot",
        label: "Overtime paid late",
        detail: `Overtime must be paid within ${OT_PAY_WINDOW_DAYS} days of ${periodEnd}.`,
        severity: "critical",
      });
    } else if (paidOnDay == null && elapsed > OT_PAY_WINDOW_DAYS) {
      issues.push({
        code: "late-ot",
        label: "Overtime unpaid past deadline",
        detail: `${elapsed} days since ${periodEnd}.`,
        severity: "critical",
      });
    }
  }

  // 3. Overtime hour cap
  const otHours = entry.overtimeHours ?? 0;
  if (otHours > OT_MONTHLY_CAP) {
    issues.push({
      code: "ot-cap",
      label: "Overtime above 72 h",
      detail: `${otHours} overtime hours recorded — MOM cap is ${OT_MONTHLY_CAP} h per month without an exemption.`,
      severity: "critical",
    });
  }

  // 4. Itemised payslip
  if (!entry.payslipIssuedAt && (entry.status === "Paid" || paidDate)) {
    issues.push({
      code: "no-payslip",
      label: "Itemised payslip not issued",
      detail: "An itemised payslip is required within 3 working days of payment.",
      severity: "warning",
    });
  }

  // 5. Paid below declared salary
  const declared = employee.declaredSalary ?? 0;
  const paid = (entry.basicSalary ?? 0) + (employee.fixedAllowance ?? 0);
  if (declared > 0 && paid + 0.01 < declared) {
    issues.push({
      code: "underpaid",
      label: "Below declared salary",
      detail: `Paid ${money(paid)} against ${money(declared)} declared to MOM.`,
      severity: "critical",
    });
  }

  // 6. Electronic payment for foreign workers
  const mode = employee.salaryPaymentMode ?? employee.paymentMethod;
  if (isForeign(employee) && (mode === "Cash" || mode === "Cheque")) {
    issues.push({
      code: "cash-payment",
      label: "Not paid electronically",
      detail: `Foreign workers should be paid by bank transfer / GIRO / PayNow (currently ${mode}).`,
      severity: "warning",
    });
  }

  return { id: entry.id, employee, entry, periodEnd, declared, paid, paidOnDay, issues };
}

/** Employees missing Key Employment Terms beyond the 14-day window. */
export function ketGaps(employees: Employee[], today = iso(new Date())): Employee[] {
  return employees.filter((e) => {
    if (e.status !== "Active") return false;
    if (e.ketIssuedOn) return false;
    if (!e.joinedOn || e.joinedOn === "-") return false;
    return daysBetween(e.joinedOn, today) > KET_WINDOW_DAYS;
  });
}

/** Build the compliance table for a set of payroll entries. */
export function salaryComplianceRows(
  employees: Employee[],
  payroll: PayrollEntry[],
  month?: string,
  today = iso(new Date()),
): SalaryComplianceRow[] {
  const byId = new Map(employees.map((e) => [e.id, e]));
  return payroll
    .filter((p) => (month ? p.month === month : true))
    .map((p) => {
      const emp = byId.get(p.employeeId);
      return emp ? evaluateEntry(emp, p, today) : null;
    })
    .filter((r): r is SalaryComplianceRow => r !== null)
    .sort((a, b) => b.issues.length - a.issues.length || a.employee.name.localeCompare(b.employee.name));
}

export interface SalarySummary {
  checked: number;
  clean: number;
  critical: number;
  warnings: number;
  latePayments: number;
  otBreaches: number;
  underpaid: number;
  missingPayslips: number;
}

export function salarySummary(rows: SalaryComplianceRow[]): SalarySummary {
  const all = rows.flatMap((r) => r.issues);
  const has = (code: SalaryIssue["code"]) => all.filter((i) => i.code === code).length;
  return {
    checked: rows.length,
    clean: rows.filter((r) => r.issues.length === 0).length,
    critical: all.filter((i) => i.severity === "critical").length,
    warnings: all.filter((i) => i.severity === "warning").length,
    latePayments: has("late-salary") + has("late-ot"),
    otBreaches: has("ot-cap"),
    underpaid: has("underpaid"),
    missingPayslips: has("no-payslip"),
  };
}
