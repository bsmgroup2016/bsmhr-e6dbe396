/**
 * Singapore government submission file builders.
 *
 * - CPF e-Submission (CPF WEB) monthly contribution file
 * - IRAS AIS / IR8A annual income return
 * - Monthly Foreign Worker Levy summary
 * - MOM manpower report
 *
 * Every builder returns plain rows so they can be exported as CSV/XLSX with
 * the existing export helpers.
 */
import type { Employee, PayrollEntry } from "@/lib/types";
import { levyFor, levyTierFor, isHeadcount, type MomSector } from "@/lib/mom";

const r2 = (n: number) => Math.round(n * 100) / 100;

/** CPF e-Submission (CPF WEB) upload sheet for one month. */
export function cpfWebRows(entries: PayrollEntry[], employees: Employee[]) {
  const byId = new Map(employees.map((e) => [e.id, e]));
  return entries
    .map((p) => {
      const e = byId.get(p.employeeId);
      if (!e) return null;
      // Only citizens/PRs contribute CPF.
      if (e.passType !== "Singaporean/PR") return null;
      const ow = r2(p.basicSalary + p.overtimePay + p.allowances);
      return {
        "CPF Account Number": e.fin ?? "",
        "Employee Name": e.name,
        "NRIC/FIN": e.fin ?? "",
        "For Month": p.month.replace("-", ""),
        "Ordinary Wages": ow,
        "Additional Wages": 0,
        "Total CPF Contribution": r2(p.cpfEmployee + p.cpfEmployer),
        "Employee CPF": r2(p.cpfEmployee),
        "Employer CPF": r2(p.cpfEmployer),
        "SDL": r2(p.sdl ?? 0),
        "Fund Code": p.shgFund && p.shgFund !== "None" ? p.shgFund : "",
        "Fund Amount": r2(p.shgAmount ?? 0),
      };
    })
    .filter(Boolean) as Record<string, unknown>[];
}

/** IRAS AIS / IR8A annual return, aggregated per employee for one year. */
export function ir8aRows(entries: PayrollEntry[], employees: Employee[], year: string) {
  const byId = new Map(employees.map((e) => [e.id, e]));
  const agg = new Map<string, { salary: number; bonus: number; ot: number; allow: number; cpf: number }>();
  for (const p of entries) {
    if (!p.month.startsWith(year)) continue;
    const cur = agg.get(p.employeeId) ?? { salary: 0, bonus: 0, ot: 0, allow: 0, cpf: 0 };
    cur.salary += p.basicSalary;
    cur.ot += p.overtimePay;
    cur.allow += p.allowances;
    cur.cpf += p.cpfEmployee;
    agg.set(p.employeeId, cur);
  }
  return [...agg.entries()]
    .map(([id, v]) => {
      const e = byId.get(id);
      if (!e) return null;
      const gross = r2(v.salary + v.ot + v.allow + v.bonus);
      return {
        "Year of Assessment": String(Number(year) + 1),
        "Tax Ref No": e.fin ?? "",
        "ID Type": e.passType === "Singaporean/PR" ? "NRIC" : "FIN",
        "Employee Name": e.name,
        "Date of Birth": e.dateOfBirth ?? "",
        Designation: e.jobTitle ?? e.workerCategory ?? "",
        "Gross Salary": r2(v.salary),
        Bonus: r2(v.bonus),
        "Overtime Pay": r2(v.ot),
        "Allowances": r2(v.allow),
        "Total Income": gross,
        "Employee CPF Contribution": r2(v.cpf),
        "Date of Commencement": e.joinedOn ?? "",
        "Date of Cessation": ["Resigned", "Terminated", "Repatriated"].includes(e.status)
          ? (e.lastWorkingDate ?? "")
          : "",
      };
    })
    .filter(Boolean) as Record<string, unknown>[];
}

/** Monthly levy + CPF summary, one row per worker plus derived totals. */
export function levySummaryRows(
  entries: PayrollEntry[],
  employees: Employee[],
  sector: MomSector,
) {
  const byId = new Map(employees.map((e) => [e.id, e]));
  return entries
    .map((p) => {
      const e = byId.get(p.employeeId);
      if (!e) return null;
      return {
        Month: p.month,
        "P-File Number": e.employeeCode,
        Name: e.name,
        "FIN / NRIC": e.fin ?? "",
        "Pass Type": e.passType,
        "Levy Tier": e.passType === "Work Permit" ? levyTierFor(e) : "-",
        "Levy Payable": r2(p.levies || levyFor(e, sector)),
        "CPF Employee": r2(p.cpfEmployee),
        "CPF Employer": r2(p.cpfEmployer),
        SDL: r2(p.sdl ?? 0),
        "SHG Fund": p.shgFund ?? "None",
        "SHG Amount": r2(p.shgAmount ?? 0),
      };
    })
    .filter(Boolean) as Record<string, unknown>[];
}

/** MOM-format manpower report: active headcount by pass type and nationality. */
export function manpowerReportRows(employees: Employee[]) {
  const active = employees.filter(isHeadcount);
  const key = (e: Employee) => `${e.nationality ?? "Unknown"}|${e.passType}|${e.workerCategory ?? "-"}`;
  const map = new Map<string, number>();
  for (const e of active) map.set(key(e), (map.get(key(e)) ?? 0) + 1);
  return [...map.entries()]
    .map(([k, count]) => {
      const [nationality, passType, category] = k.split("|");
      return { Nationality: nationality, "Pass Type": passType, "Worker Category": category, Headcount: count };
    })
    .sort((a, b) => b.Headcount - a.Headcount);
}
