/**
 * Singapore statutory payroll engine.
 *
 * Covers CPF (age + PR-graduated rates), SDL, and the Self-Help Group funds
 * (CDAC / MBMF / SINDA / ECF). Foreign pass holders pay the Foreign Worker Levy
 * instead of CPF.
 *
 * Rates are kept in plain tables at the top of this file so finance staff can
 * update them each year without touching the calculation logic.
 */
import type { Employee } from "@/lib/types";

/** Ordinary Wage ceiling subject to CPF, per month. */
export const OW_CEILING = 8000;
/** Total Wage ceiling for the year (used for Additional Wage capping). */
export const AW_CEILING_YEAR = 102000;

export type EthnicGroup = "Chinese" | "Malay" | "Indian" | "Eurasian" | "Others";
export type PrStatus = "Citizen" | "PR Year 1" | "PR Year 2" | "PR Year 3+";

export const ETHNIC_GROUPS: EthnicGroup[] = ["Chinese", "Malay", "Indian", "Eurasian", "Others"];
export const PR_STATUSES: PrStatus[] = ["Citizen", "PR Year 1", "PR Year 2", "PR Year 3+"];

interface CpfRate { employer: number; employee: number }

/** Full rates (Citizen / PR 3rd year onwards) by age band. */
const FULL_RATES: { maxAge: number; rate: CpfRate }[] = [
  { maxAge: 55, rate: { employer: 0.17, employee: 0.2 } },
  { maxAge: 60, rate: { employer: 0.16, employee: 0.175 } },
  { maxAge: 65, rate: { employer: 0.125, employee: 0.12 } },
  { maxAge: 70, rate: { employer: 0.09, employee: 0.075 } },
  { maxAge: 200, rate: { employer: 0.075, employee: 0.05 } },
];

/** Graduated rates for PRs in their 1st and 2nd year (age 55 and below). */
const PR_GRADUATED: Record<"PR Year 1" | "PR Year 2", CpfRate> = {
  "PR Year 1": { employer: 0.04, employee: 0.05 },
  "PR Year 2": { employer: 0.09, employee: 0.15 },
};

/** Minimum employee CPF is waived below this monthly wage. */
const CPF_EMPLOYEE_FLOOR = 750;
const CPF_NO_EMPLOYEE_SHARE_BELOW = 500;

export function ageOn(dateOfBirth?: string, on: Date = new Date()): number {
  if (!dateOfBirth) return 30;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return 30;
  let age = on.getFullYear() - dob.getFullYear();
  const m = on.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && on.getDate() < dob.getDate())) age -= 1;
  return age;
}

function rateFor(age: number, prStatus: PrStatus): CpfRate {
  if ((prStatus === "PR Year 1" || prStatus === "PR Year 2") && age <= 55) {
    return PR_GRADUATED[prStatus];
  }
  return FULL_RATES.find((b) => age <= b.maxAge)!.rate;
}

export function isCpfEligible(employee: Pick<Employee, "passType">): boolean {
  return employee.passType === "Singaporean/PR";
}

export interface CpfResult {
  cpfEmployee: number;
  cpfEmployer: number;
  cpfTotal: number;
  cappedWage: number;
  age: number;
  rate: CpfRate;
}

/** CPF for one month of ordinary wages. */
export function computeCpfContribution(
  employee: Pick<Employee, "passType" | "dateOfBirth" | "prStatus">,
  grossWage: number,
  on: Date = new Date(),
): CpfResult {
  const age = ageOn(employee.dateOfBirth, on);
  const rate = rateFor(age, (employee.prStatus as PrStatus) || "Citizen");
  if (!isCpfEligible(employee) || grossWage <= 0) {
    return { cpfEmployee: 0, cpfEmployer: 0, cpfTotal: 0, cappedWage: 0, age, rate };
  }
  const capped = Math.min(grossWage, OW_CEILING);
  const cpfEmployer = round2(capped * rate.employer);
  let cpfEmployee = 0;
  if (grossWage > CPF_EMPLOYEE_FLOOR) {
    cpfEmployee = round2(capped * rate.employee);
  } else if (grossWage > CPF_NO_EMPLOYEE_SHARE_BELOW) {
    // Phased-in employee share between $500 and $750.
    cpfEmployee = round2(0.6 * (grossWage - CPF_NO_EMPLOYEE_SHARE_BELOW) * rate.employee * 2);
  }
  return {
    cpfEmployee,
    cpfEmployer,
    cpfTotal: round2(cpfEmployee + cpfEmployer),
    cappedWage: capped,
    age,
    rate,
  };
}

/**
 * Skills Development Levy — payable for every employee (local and foreign):
 * 0.25% of monthly wage, minimum $2, maximum $11.25.
 */
export function computeSdl(grossWage: number): number {
  if (grossWage <= 0) return 0;
  const raw = grossWage * 0.0025;
  return round2(Math.min(Math.max(raw, 2), 11.25));
}

/**
 * Additional Wage (AW) ceiling: bonuses and other non-monthly payments attract
 * CPF only up to $102,000 minus the year's total Ordinary Wages.
 */
export function additionalWageCeiling(annualOrdinaryWages: number): number {
  return Math.max(0, AW_CEILING_YEAR - Math.min(annualOrdinaryWages, AW_CEILING_YEAR));
}

/** Portion of an Additional Wage payment that is subject to CPF. */
export function cpfableAdditionalWage(additionalWage: number, annualOrdinaryWages: number): number {
  if (additionalWage <= 0) return 0;
  return round2(Math.min(additionalWage, additionalWageCeiling(annualOrdinaryWages)));
}

type Bracket = { upTo: number; amount: number };

const CDAC: Bracket[] = [
  { upTo: 2000, amount: 0.5 },
  { upTo: 3500, amount: 1 },
  { upTo: 5000, amount: 1.5 },
  { upTo: 7500, amount: 2 },
  { upTo: Infinity, amount: 3 },
];

const MBMF: Bracket[] = [
  { upTo: 1000, amount: 3 },
  { upTo: 2000, amount: 4.5 },
  { upTo: 3000, amount: 6.5 },
  { upTo: 4000, amount: 15 },
  { upTo: 6000, amount: 19.5 },
  { upTo: 8000, amount: 22 },
  { upTo: 10000, amount: 24 },
  { upTo: Infinity, amount: 26 },
];

const SINDA: Bracket[] = [
  { upTo: 1000, amount: 1 },
  { upTo: 1500, amount: 3 },
  { upTo: 2500, amount: 5 },
  { upTo: 4500, amount: 7 },
  { upTo: 7500, amount: 12 },
  { upTo: 10000, amount: 18 },
  { upTo: 15000, amount: 25 },
  { upTo: Infinity, amount: 30 },
];

const ECF: Bracket[] = [
  { upTo: 1000, amount: 2 },
  { upTo: 1500, amount: 4 },
  { upTo: 2500, amount: 6 },
  { upTo: 4000, amount: 9 },
  { upTo: 7000, amount: 12 },
  { upTo: 10000, amount: 16 },
  { upTo: Infinity, amount: 20 },
];

export type ShgFund = "CDAC" | "MBMF" | "SINDA" | "ECF" | "None";

const SHG_TABLE: Record<Exclude<ShgFund, "None">, Bracket[]> = {
  CDAC, MBMF, SINDA, ECF,
};

/** Muslim staff of any ethnicity contribute to MBMF; otherwise ethnicity decides. */
export function shgFundFor(
  employee: Pick<Employee, "passType" | "ethnicGroup" | "religion">,
): ShgFund {
  if (!isCpfEligible(employee)) return "None";
  if (employee.religion === "Muslim") return "MBMF";
  switch (employee.ethnicGroup) {
    case "Chinese": return "CDAC";
    case "Malay": return "MBMF";
    case "Indian": return "SINDA";
    case "Eurasian": return "ECF";
    default: return "None";
  }
}

export function computeShg(fund: ShgFund, grossWage: number): number {
  if (fund === "None" || grossWage <= 0) return 0;
  const bracket = SHG_TABLE[fund].find((b) => grossWage <= b.upTo);
  return bracket ? bracket.amount : 0;
}

export interface StatutoryResult {
  cpfEmployee: number;
  cpfEmployer: number;
  sdl: number;
  shgFund: ShgFund;
  shgAmount: number;
  levy: number;
  /** Total employer outlay: gross + employer CPF + SDL + levy. */
  employerCost: number;
  age: number;
}

/** One-stop statutory calculation for a month's gross wage. */
export function computeStatutory(
  employee: Pick<
    Employee,
    "passType" | "dateOfBirth" | "prStatus" | "ethnicGroup" | "religion" | "levyRate"
  >,
  grossWage: number,
  on: Date = new Date(),
): StatutoryResult {
  const cpf = computeCpfContribution(employee, grossWage, on);
  const sdl = computeSdl(grossWage);
  const fund = shgFundFor(employee);
  const shgAmount = computeShg(fund, grossWage);
  const levy = isCpfEligible(employee) ? 0 : round2(employee.levyRate ?? 0);
  return {
    cpfEmployee: cpf.cpfEmployee,
    cpfEmployer: cpf.cpfEmployer,
    sdl,
    shgFund: fund,
    shgAmount,
    levy,
    employerCost: round2(grossWage + cpf.cpfEmployer + sdl + levy),
    age: cpf.age,
  };
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}