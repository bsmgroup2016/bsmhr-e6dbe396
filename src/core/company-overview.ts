import type { Company, Employee, EmployeeCertification, PayrollEntry } from "@/lib/types";
import { isCountableWorker } from "@/lib/workforce-split";

export function orderedCompanies(companies: Company[]) {
  const rank = (code: string) => ({ BSM: 0, VRL: 1, PLUTO: 2 }[code.toUpperCase()] ?? 3);
  return [...companies].sort((a, b) => rank(a.code) - rank(b.code) || a.name.localeCompare(b.name));
}

export function companyOverview(
  employees: Employee[], certifications: EmployeeCertification[], payroll: PayrollEntry[],
  companyId?: string, now = new Date(),
) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Singapore", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const year = today.slice(0, 4);
  const day = new Date(`${today}T00:00:00+08:00`).getTime();
  const due = (date?: string) => {
    if (!date || date === "-") return false;
    const diff = (new Date(`${date}T00:00:00+08:00`).getTime() - day) / 86_400_000;
    return Number.isFinite(diff) && diff >= 0 && diff <= 60;
  };
  const staff = employees.filter((e) => !companyId || e.companyId === companyId);
  const workers = staff.filter(isCountableWorker);
  const ids = new Set(staff.map((e) => e.id));
  const workerIds = new Set(workers.map((e) => e.id));
  const waiting = workers.filter((e) => e.passType === "Work Permit" && ["IPA Issued", "Arrived", "Medical Cleared"].includes(e.wpStage ?? ""));
  const permits = workers.filter((e) => e.passType === "Work Permit" && due(e.passExpiry));
  const permitDay = (e: Employee) => e.passType === "Work Permit" && e.passExpiry && e.passExpiry !== "-" ? new Date(`${e.passExpiry}T00:00:00+08:00`).getTime() : NaN;
  const livePermits = workers.filter((e) => permitDay(e) >= day && ["Card Issued", "Active"].includes(e.wpStage ?? "Active"));
  const expiredPermits = workers.filter((e) => permitDay(e) < day);
  const csocIds = new Set(workers.filter((e) => due(e.safetyCourseExpiry) && (!e.safetyCourseType || /csoc|safety orientation|safety course/i.test(e.safetyCourseType))).map((e) => e.id));
  certifications.forEach((c) => {
    if (workerIds.has(c.employeeId) && /csoc|safety orientation|safety course/i.test(c.courseName) && due(c.expiryDate)) csocIds.add(c.employeeId);
  });
  const annualPayroll = payroll.filter((p) => ids.has(p.employeeId) && p.month.startsWith(`${year}-`) && p.status !== "Rejected");
  return {
    year, staff, workers, waiting, permits, livePermits, expiredPermits, csoc: workers.filter((e) => csocIds.has(e.id)), annualPayroll,
    annualWages: annualPayroll.reduce((sum, p) => sum + p.basicSalary + p.overtimePay + p.allowances + (p.bonus ?? 0), 0),
  };
}