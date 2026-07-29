/**
 * MOM (Ministry of Manpower, Singapore) compliance helpers.
 *
 * Covers three things the payroll engine does not:
 *  1. Foreign Worker Levy (FWL) rates by sector, pass type and levy tier.
 *  2. Dependency Ratio Ceiling (DRC) / S Pass sub-quota checking.
 *  3. Medical insurance & six-monthly medical examination tracking.
 *
 * Rates follow the published MOM tables. They are kept in one place so they can
 * be updated in a single edit when MOM revises them.
 */
import type { Employee } from "@/lib/types";
import { daysUntil, severityFor, type ComplianceSeverity } from "@/lib/compliance";

export type MomSector =
  | "Construction"
  | "Manufacturing"
  | "Marine Shipyard"
  | "Process"
  | "Services";

export const MOM_SECTORS: MomSector[] = [
  "Construction",
  "Manufacturing",
  "Marine Shipyard",
  "Process",
  "Services",
];

/** Levy tier: skilled (higher-skilled) workers attract a lower levy. */
export type LevyTier = "Higher Skilled" | "Basic Skilled";

/**
 * Dependency Ratio Ceiling — maximum share of the workforce that may be
 * foreign, plus the S Pass sub-quota, expressed as a fraction of total
 * workforce (local + foreign).
 */
export const DRC: Record<MomSector, { drc: number; sPassSubQuota: number }> = {
  Construction: { drc: 0.8333, sPassSubQuota: 0.15 },
  Manufacturing: { drc: 0.6, sPassSubQuota: 0.18 },
  "Marine Shipyard": { drc: 0.7692, sPassSubQuota: 0.18 },
  Process: { drc: 0.8571, sPassSubQuota: 0.18 },
  Services: { drc: 0.35, sPassSubQuota: 0.1 },
};

/** Monthly Work Permit levy (S$) by sector and skill tier. */
const WP_LEVY: Record<MomSector, Record<LevyTier, number>> = {
  Construction: { "Higher Skilled": 300, "Basic Skilled": 700 },
  Manufacturing: { "Higher Skilled": 300, "Basic Skilled": 450 },
  "Marine Shipyard": { "Higher Skilled": 300, "Basic Skilled": 400 },
  Process: { "Higher Skilled": 300, "Basic Skilled": 750 },
  Services: { "Higher Skilled": 450, "Basic Skilled": 700 },
};

/** Monthly S Pass levy (S$) by sector. */
const SP_LEVY: Record<MomSector, number> = {
  Construction: 550,
  Manufacturing: 650,
  "Marine Shipyard": 650,
  Process: 650,
  Services: 650,
};

/** Workers holding these categories are treated as higher-skilled by default. */
const SKILLED_CATEGORIES = ["Skilled", "Supervisor", "Office Staff"];

export function levyTierFor(e: Pick<Employee, "levyTier" | "workerCategory">): LevyTier {
  if (e.levyTier) return e.levyTier;
  return SKILLED_CATEGORIES.includes(e.workerCategory ?? "") ? "Higher Skilled" : "Basic Skilled";
}

/** Statutory monthly levy for one employee. Locals/PRs pay CPF, not levy. */
export function levyFor(
  e: Pick<Employee, "passType" | "levyTier" | "workerCategory" | "levyRate">,
  sector: MomSector,
): number {
  if (e.passType === "Singaporean/PR" || e.passType === "Employment Pass") return 0;
  if (e.passType === "S Pass") return SP_LEVY[sector];
  return WP_LEVY[sector][levyTierFor(e)];
}

const INACTIVE = ["Archived", "Resigned", "Terminated", "Repatriated", "Draft"];
export const isHeadcount = (e: Employee) => !INACTIVE.includes(e.status);

export interface QuotaResult {
  sector: MomSector;
  local: number;
  workPermit: number;
  sPass: number;
  employmentPass: number;
  total: number;
  /** Foreign workers (WP + S Pass) counted against the DRC. */
  foreign: number;
  /** Maximum foreign workers allowed with the current local headcount. */
  foreignAllowed: number;
  sPassAllowed: number;
  drcUsage: number;
  sPassUsage: number;
  /** Extra foreign workers that can still be hired (negative = over quota). */
  foreignHeadroom: number;
  sPassHeadroom: number;
  overQuota: boolean;
}

/** DRC and S Pass sub-quota position for a workforce. */
export function computeQuota(employees: Employee[], sector: MomSector): QuotaResult {
  const active = employees.filter(isHeadcount);
  const local = active.filter((e) => e.passType === "Singaporean/PR").length;
  const workPermit = active.filter((e) => e.passType === "Work Permit").length;
  const sPass = active.filter((e) => e.passType === "S Pass").length;
  const employmentPass = active.filter((e) => e.passType === "Employment Pass").length;
  const foreign = workPermit + sPass;
  const { drc, sPassSubQuota } = DRC[sector];

  // DRC caps foreign share of total workforce, so allowed = local * ratio/(1-ratio).
  const foreignAllowed = Math.floor((local * drc) / (1 - drc));
  const total = local + foreign;
  const sPassAllowed = Math.floor((local + foreign) * sPassSubQuota);

  return {
    sector,
    local,
    workPermit,
    sPass,
    employmentPass,
    total,
    foreign,
    foreignAllowed,
    sPassAllowed,
    drcUsage: foreignAllowed > 0 ? foreign / foreignAllowed : foreign > 0 ? Infinity : 0,
    sPassUsage: sPassAllowed > 0 ? sPass / sPassAllowed : sPass > 0 ? Infinity : 0,
    foreignHeadroom: foreignAllowed - foreign,
    sPassHeadroom: sPassAllowed - sPass,
    overQuota: foreign > foreignAllowed || sPass > sPassAllowed,
  };
}

export interface LevySummary {
  total: number;
  workPermitLevy: number;
  sPassLevy: number;
  byTier: { tier: LevyTier; count: number; amount: number }[];
  perWorker: { employee: Employee; levy: number; tier: LevyTier }[];
}

/** Monthly levy bill for a workforce. */
export function levySummary(employees: Employee[], sector: MomSector): LevySummary {
  const active = employees.filter(isHeadcount);
  const perWorker = active
    .map((employee) => ({ employee, levy: levyFor(employee, sector), tier: levyTierFor(employee) }))
    .filter((r) => r.levy > 0)
    .sort((a, b) => b.levy - a.levy);

  const tiers: LevyTier[] = ["Higher Skilled", "Basic Skilled"];
  return {
    total: perWorker.reduce((s, r) => s + r.levy, 0),
    workPermitLevy: perWorker
      .filter((r) => r.employee.passType === "Work Permit")
      .reduce((s, r) => s + r.levy, 0),
    sPassLevy: perWorker
      .filter((r) => r.employee.passType === "S Pass")
      .reduce((s, r) => s + r.levy, 0),
    byTier: tiers.map((tier) => {
      const rows = perWorker.filter((r) => r.tier === tier);
      return { tier, count: rows.length, amount: rows.reduce((s, r) => s + r.levy, 0) };
    }),
    perWorker,
  };
}

export interface InsuranceItem {
  employee: Employee;
  kind: "Medical insurance" | "Medical examination";
  dueDate: string | null;
  daysLeft: number | null;
  severity: ComplianceSeverity | "missing";
}

/**
 * Medical insurance and six-monthly medical examination status for every
 * Work Permit / S Pass holder — both are MOM requirements for employers.
 */
export function insuranceItems(employees: Employee[]): InsuranceItem[] {
  const needsCover = (e: Employee) => e.passType === "Work Permit" || e.passType === "S Pass";
  const rows: InsuranceItem[] = [];

  for (const employee of employees.filter((e) => isHeadcount(e) && needsCover(e))) {
    const entries: [InsuranceItem["kind"], string | undefined][] = [
      ["Medical insurance", employee.medicalInsuranceExpiry],
      ["Medical examination", employee.medicalCheckupDue],
    ];
    for (const [kind, date] of entries) {
      const days = daysUntil(date);
      rows.push({
        employee,
        kind,
        dueDate: date || null,
        daysLeft: days,
        severity: days === null ? "missing" : severityFor(days),
      });
    }
  }

  const order = { missing: 0, expired: 1, critical: 2, warning: 3, ok: 4 };
  return rows.sort((a, b) => order[a.severity] - order[b.severity] || (a.daysLeft ?? 0) - (b.daysLeft ?? 0));
}
