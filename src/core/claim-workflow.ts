import { NO_COMPANY, type CompanyClaimSummary } from "./company-claim-summary";
import type { Employee, PayrollEntry } from "@/lib/types";

export function eligibleClaimSummaries(summaries: CompanyClaimSummary[]) {
  return summaries.filter(s => s.companyId !== NO_COMPANY);
}

export function claimSalaryRows(summaries: CompanyClaimSummary[], employees: Employee[], payroll: PayrollEntry[], month: string) {
  return eligibleClaimSummaries(summaries).flatMap(company => company.workers.map(worker => {
    const employee = employees.find(e => e.id === worker.key) ?? employees.find(e => e.companyId === company.companyId && e.employeeCode === worker.code);
    const entries = employee ? payroll.filter(p => p.employeeId === employee.id && p.month === month && p.status !== "Rejected") : [];
    // Ambiguous payroll must be resolved in Payroll, not silently doubled here.
    const entry = entries.length === 1 ? entries[0] : undefined;
    return {
      Company: company.companyName,
      "P-File number": worker.code,
      Name: worker.name,
      "G hours": worker.projects.reduce((total, p) => total + p.normalHours, 0),
      "OT hours": worker.projects.reduce((total, p) => total + p.otHours, 0),
      "Basic salary (SGD)": entry?.basicSalary ?? null,
      "OT pay (SGD)": entry?.overtimePay ?? null,
      "Allowances (SGD)": entry?.allowances ?? null,
      "Bonus (SGD)": entry?.bonus ?? (entry ? 0 : null),
      "Deductions (SGD)": entry?.deductions ?? null,
      "CPF employee (SGD)": entry?.cpfEmployee ?? null,
      "SHG (SGD)": entry?.shgAmount ?? (entry ? 0 : null),
      "Net pay (SGD)": entry?.netPay ?? null,
      Status: entry?.status ?? (entries.length > 1 ? "Multiple payroll entries" : employee ? "Payroll not prepared" : "Worker not linked"),
    };
  }));
}