/**
 * Loan / salary-advance ledger logic.
 *
 * MOM rules applied here:
 *  - Loan or advance recovery may not exceed 25% of a worker's monthly salary.
 *  - Written worker consent is required before any recovery deduction.
 *  - Outstanding balances must be settled before repatriation / pass cancellation.
 */
import type { Employee, EmployeeLoan, LoanRepayment } from "@/lib/types";

export const LOAN_RECOVERY_CAP = 0.25;

const r2 = (n: number) => Math.round(n * 100) / 100;

export interface LoanLedgerRow {
  loan: EmployeeLoan;
  employee?: Employee;
  repaid: number;
  outstanding: number;
  progress: number;
  /** Months left at the agreed installment. */
  monthsRemaining: number;
  installmentPct: number;
  issues: string[];
}

export function loanLedger(
  loans: EmployeeLoan[],
  repayments: LoanRepayment[],
  employees: Employee[],
): LoanLedgerRow[] {
  const empById = new Map(employees.map((e) => [e.id, e]));
  const paidByLoan = new Map<string, number>();
  for (const p of repayments) {
    paidByLoan.set(p.loanId, (paidByLoan.get(p.loanId) ?? 0) + (p.amount || 0));
  }

  return loans
    .map((loan) => {
      const employee = empById.get(loan.employeeId);
      const repaid = r2(paidByLoan.get(loan.id) ?? 0);
      const outstanding = r2(Math.max(0, loan.principal - repaid));
      const progress = loan.principal > 0 ? Math.min(1, repaid / loan.principal) : 0;
      const monthsRemaining =
        loan.monthlyInstallment > 0 ? Math.ceil(outstanding / loan.monthlyInstallment) : 0;
      const salary = employee?.basicSalary ?? 0;
      const installmentPct = salary > 0 ? loan.monthlyInstallment / salary : 0;

      const issues: string[] = [];
      if (!loan.consentSigned && loan.status === "Active") {
        issues.push("No signed worker consent for deduction");
      }
      if (installmentPct > LOAN_RECOVERY_CAP) {
        issues.push(`Installment ${Math.round(installmentPct * 100)}% exceeds the 25% salary cap`);
      }
      if (repaid > loan.principal + 0.01) {
        issues.push(`Over-recovered by $${r2(repaid - loan.principal)}`);
      }
      if (
        outstanding > 0 &&
        employee &&
        ["Resigned", "Terminated", "Repatriated"].includes(employee.status)
      ) {
        issues.push("Worker exiting with an outstanding balance");
      }

      return { loan, employee, repaid, outstanding, progress, monthsRemaining, installmentPct, issues };
    })
    .sort((a, b) => {
      if (a.issues.length !== b.issues.length) return b.issues.length - a.issues.length;
      return b.outstanding - a.outstanding;
    });
}

export function loanSummary(rows: LoanLedgerRow[]) {
  const active = rows.filter((r) => r.loan.status === "Active");
  return {
    activeLoans: active.length,
    totalPrincipal: r2(rows.reduce((s, r) => s + r.loan.principal, 0)),
    totalRepaid: r2(rows.reduce((s, r) => s + r.repaid, 0)),
    totalOutstanding: r2(active.reduce((s, r) => s + r.outstanding, 0)),
    flagged: rows.filter((r) => r.issues.length > 0).length,
  };
}

/** Installments due for a payroll month, ready to feed the payroll deduction field. */
export function dueInstallments(rows: LoanLedgerRow[], month: string) {
  return rows
    .filter((r) => r.loan.status === "Active" && r.outstanding > 0)
    .filter((r) => !r.loan.firstDeductionMonth || r.loan.firstDeductionMonth <= month)
    .map((r) => ({
      loanId: r.loan.id,
      employeeId: r.loan.employeeId,
      employeeName: r.employee?.name ?? "",
      amount: r2(Math.min(r.loan.monthlyInstallment, r.outstanding)),
      outstandingAfter: r2(Math.max(0, r.outstanding - r.loan.monthlyInstallment)),
    }))
    .filter((x) => x.amount > 0);
}

export function loanExportRows(rows: LoanLedgerRow[]) {
  return rows.map((r) => ({
    "Loan No": r.loan.loanNo,
    "Employee": r.employee?.name ?? "",
    "P-File Number": r.employee?.employeeCode ?? "",
    "Type": r.loan.loanType,
    "Issued On": r.loan.issuedOn ?? "",
    "Principal": r.loan.principal,
    "Repaid": r.repaid,
    "Outstanding": r.outstanding,
    "Monthly Installment": r.loan.monthlyInstallment,
    "Installment % of salary": Math.round(r.installmentPct * 100),
    "Months Remaining": r.monthsRemaining,
    "Consent Signed": r.loan.consentSigned ? "Yes" : "No",
    "Status": r.loan.status,
    "Issues": r.issues.join("; "),
  }));
}
