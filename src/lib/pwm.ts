/**
 * Progressive Wage Model (PWM) wage floors.
 *
 * Sector wage ladders set a minimum basic monthly wage for each job level.
 * Figures below follow the published PWM schedules; finance can update the
 * tables each year without touching the checking logic.
 */
import type { Employee, PwmSector } from "@/lib/types";

export interface PwmStep {
  level: string;
  minWage: number;
}

export const PWM_LADDER: Record<Exclude<PwmSector, "None">, PwmStep[]> = {
  Cleaning: [
    { level: "Office / Commercial cleaner", minWage: 1740 },
    { level: "F&B cleaner", minWage: 1870 },
    { level: "Conservancy cleaner", minWage: 1930 },
    { level: "Machine operator", minWage: 2065 },
    { level: "Supervisor", minWage: 2445 },
  ],
  Security: [
    { level: "Security officer", minWage: 2650 },
    { level: "Senior security officer", minWage: 2870 },
    { level: "Security supervisor", minWage: 3140 },
    { level: "Senior security supervisor", minWage: 3450 },
    { level: "Security team leader", minWage: 3750 },
  ],
  Landscape: [
    { level: "Landscape worker", minWage: 1800 },
    { level: "Landscape technician", minWage: 2000 },
    { level: "Landscape supervisor", minWage: 2500 },
  ],
  "Lift & Escalator": [
    { level: "Apprentice technician", minWage: 2000 },
    { level: "Technician", minWage: 2600 },
    { level: "Senior technician", minWage: 3200 },
    { level: "Specialist", minWage: 3900 },
  ],
  "Waste Management": [
    { level: "Collection crew", minWage: 2210 },
    { level: "Driver", minWage: 2600 },
    { level: "Supervisor", minWage: 3000 },
  ],
  Retail: [
    { level: "Assistant", minWage: 2175 },
    { level: "Senior assistant", minWage: 2400 },
    { level: "Team leader", minWage: 2800 },
  ],
  "Food Services": [
    { level: "Crew", minWage: 2035 },
    { level: "Cook", minWage: 2300 },
    { level: "Team leader", minWage: 2600 },
  ],
  Administration: [
    { level: "Administrative assistant", minWage: 2100 },
  ],
  Drivers: [
    { level: "Driver", minWage: 2100 },
  ],
};

export const PWM_SECTORS = Object.keys(PWM_LADDER) as Exclude<PwmSector, "None">[];

export function pwmApplies(e: Employee): boolean {
  if (!e.pwmSector || e.pwmSector === "None") return false;
  // PWM wage floors apply to Singaporean and PR employees.
  return e.passType === "Singaporean/PR" || (!!e.prStatus && e.prStatus !== "Citizen") || e.prStatus === "Citizen";
}

export function pwmFloor(e: Employee): number | null {
  if (!e.pwmSector || e.pwmSector === "None") return null;
  const ladder = PWM_LADDER[e.pwmSector];
  if (!ladder) return null;
  const step = ladder.find((s) => s.level === e.pwmLevel);
  return step ? step.minWage : ladder[0].minWage;
}

export interface PwmRow {
  employee: Employee;
  sector: PwmSector;
  level: string;
  floor: number;
  actual: number;
  shortfall: number;
  compliant: boolean;
}

export function pwmRows(employees: Employee[]): PwmRow[] {
  return employees
    .filter(pwmApplies)
    .map((e) => {
      const floor = pwmFloor(e) ?? 0;
      const actual = (e.basicSalary ?? 0) + (e.fixedAllowance ?? 0);
      const shortfall = Math.max(0, floor - actual);
      return {
        employee: e,
        sector: e.pwmSector as PwmSector,
        level: e.pwmLevel ?? PWM_LADDER[e.pwmSector as Exclude<PwmSector, "None">]?.[0]?.level ?? "—",
        floor, actual, shortfall, compliant: shortfall === 0,
      };
    })
    .sort((a, b) => b.shortfall - a.shortfall || a.employee.name.localeCompare(b.employee.name));
}

export interface PwmSummary {
  covered: number;
  belowFloor: number;
  totalShortfall: number;
}

export function pwmSummary(rows: PwmRow[]): PwmSummary {
  return {
    covered: rows.length,
    belowFloor: rows.filter((r) => !r.compliant).length,
    totalShortfall: rows.reduce((s, r) => s + r.shortfall, 0),
  };
}