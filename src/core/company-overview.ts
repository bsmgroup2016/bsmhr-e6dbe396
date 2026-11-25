import type { Company, Employee, EmployeeCertification, PayrollEntry } from "@/lib/types";
import { isCountableWorker } from "@/lib/workforce-split";

// Official CSOC course title is "Apply Workplace Safety and Health in Construction Sites"; SOC is a common short form.
const CSOC_RE = /csoc|\bsoc\b|safety orientation|safety course|safety and health in construction/i;

export { CSOC_RE };

export function orderedCompanies(companies: Company[]) {
  const rank = (code: string) => ({ BSM: 0, VRL: 1, PLUTO: 2, PLT: 2 }[code.toUpperCase()] ?? 3);
  return [...companies].sort((a, b) => rank(a.code) - rank(b.code) || a.name.localeCompare(b.name));
}

export function companyOverview(
  employees: Employee[], certifications: EmployeeCertification[], payroll: PayrollEntry[],
  companyId?: string, now = new Date(),
) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Singapore", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const year = today.slice(0, 4);
  const day = new Date(`${today}T00:00:00+08:00`).getTime();
  const due = (date?: string, window = 60) => {
    if (!date || date === "-") return false;
    const diff = (new Date(`${date}T00:00:00+08:00`).getTime() - day) / 86_400_000;
    return Number.isFinite(diff) && diff >= 0 && diff <= window;
  };
  const staff = employees.filter((e) => !companyId || e.companyId === companyId);
  const workers = staff.filter(isCountableWorker);
  const ids = new Set(staff.map((e) => e.id));
  const workerIds = new Set(workers.map((e) => e.id));
  const newIpa = workers.filter((e) => e.passType === "Work Permit" && e.wpStage === "IPA Issued");
  const waiting = workers.filter((e) => e.passType === "Work Permit" && ["IPA Issued", "Arrived", "Medical Cleared"].includes(e.wpStage ?? ""));
  const permits = workers.filter((e) => e.passType === "Work Permit" && due(e.passExpiry));
  const passports = workers.filter((e) => due(e.passportExpiry, 90));
  const csocIds = new Set(workers.filter((e) => due(e.safetyCourseExpiry) && (!e.safetyCourseType || CSOC_RE.test(e.safetyCourseType))).map((e) => e.id));
  certifications.forEach((c) => {
    if (workerIds.has(c.employeeId) && CSOC_RE.test(c.courseName) && due(c.expiryDate)) csocIds.add(c.employeeId);
  });
  const coreIds = new Set(workers.filter((e) => due(e.skillCertExpiry) && (e.skillCertType === "Skills Evaluation (SEC(K))" || /coretrade|core trade/i.test(e.skillCertType ?? ""))).map((e) => e.id));
  certifications.forEach((c) => {
    if (workerIds.has(c.employeeId) && /coretrade|core trade|sec\s*\(k\)/i.test(c.courseName) && due(c.expiryDate)) coreIds.add(c.employeeId);
  });
  const annualPayroll = payroll.filter((p) => ids.has(p.employeeId) && p.month.startsWith(`${year}-`) && p.status !== "Rejected");
  return {
    year, staff, workers, newIpa, waiting, coretrade: workers.filter((e) => coreIds.has(e.id)), permits, passports, csoc: workers.filter((e) => csocIds.has(e.id)), annualPayroll,
    annualWages: annualPayroll.reduce((sum, p) => sum + p.basicSalary + p.overtimePay + p.allowances + (p.bonus ?? 0), 0),
  };
}