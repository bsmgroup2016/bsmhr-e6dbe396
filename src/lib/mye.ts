/**
 * Man-Year Entitlement (MYE) and skills upgrading for construction / process
 * sector Work Permit holders.
 *
 * One MYE equals one man-year of work on a project. Employers draw MYE from a
 * project allocation to bring in non-traditional-source and PRC workers, and
 * the levy tier depends on whether a worker is Basic or Higher Skilled.
 * Higher Skilled status requires a recognised certificate (TCTO, SETO,
 * multi-skilling or SEC(K)).
 */
import type { Employee, SkillCertType, SkillLevel } from "@/lib/types";
import { daysUntil } from "@/lib/compliance";

export const SKILL_LEVELS: SkillLevel[] = ["Basic Skilled", "Higher Skilled"];
export const SKILL_CERT_TYPES: SkillCertType[] = [
  "TCTO", "SETO", "Multi-Skilling (MSC)", "Skills Evaluation (SEC(K))", "Other",
];

/** Default man-years consumed per worker per year. */
export const MYE_PER_WORKER_YEAR = 1;

/** Monthly levy saving when a worker is upgraded to Higher Skilled. */
export const HIGHER_SKILLED_LEVY_SAVING = 350;

export function skillLevelOf(e: Employee): SkillLevel {
  if (e.skillLevel) return e.skillLevel;
  if (e.levyTier === "Higher Skilled") return "Higher Skilled";
  return "Basic Skilled";
}

/** A Higher Skilled claim is only valid with an unexpired certificate. */
export function skillCertValid(e: Employee): boolean {
  if (!e.skillCertType && !e.skillCertNo) return false;
  const left = daysUntil(e.skillCertExpiry);
  return left === null || left >= 0;
}

export type MyeIssue = "cert-missing" | "cert-expired" | "cert-expiring" | "no-mye" | "upgrade-opportunity";

export interface MyeRow {
  employee: Employee;
  skillLevel: SkillLevel;
  certValid: boolean;
  manYears: number;
  issues: { code: MyeIssue; label: string; severity: "critical" | "warning" | "info" }[];
}

function isConstruction(e: Employee): boolean {
  return e.passType === "Work Permit";
}

export function myeFor(e: Employee): MyeRow {
  const skillLevel = skillLevelOf(e);
  const certValid = skillCertValid(e);
  const left = daysUntil(e.skillCertExpiry);
  const issues: MyeRow["issues"] = [];

  if (skillLevel === "Higher Skilled" && !certValid) {
    issues.push({
      code: e.skillCertType ? "cert-expired" : "cert-missing",
      label: e.skillCertType
        ? "Higher Skilled certificate expired — levy reverts to Basic tier"
        : "Higher Skilled claimed without a certificate on file",
      severity: "critical",
    });
  } else if (skillLevel === "Higher Skilled" && left != null && left <= 60) {
    issues.push({ code: "cert-expiring", label: `Skills certificate expires in ${left} days`, severity: "warning" });
  }

  if (skillLevel === "Basic Skilled") {
    issues.push({
      code: "upgrade-opportunity",
      label: `Upgrade to Higher Skilled saves about $${HIGHER_SKILLED_LEVY_SAVING}/month in levy`,
      severity: "info",
    });
  }

  if (!e.myeRef) {
    issues.push({ code: "no-mye", label: "No MYE allocation reference recorded", severity: "warning" });
  }

  return { employee: e, skillLevel, certValid, manYears: e.myeManYears ?? MYE_PER_WORKER_YEAR, issues };
}

export function myeRows(employees: Employee[]): MyeRow[] {
  const rank = { critical: 0, warning: 1, info: 2 } as const;
  return employees
    .filter(isConstruction)
    .map(myeFor)
    .sort((a, b) => {
      const sa = a.issues[0] ? rank[a.issues[0].severity] : 3;
      const sb = b.issues[0] ? rank[b.issues[0].severity] : 3;
      return sa - sb || a.employee.name.localeCompare(b.employee.name);
    });
}

export interface MyeSummary {
  workers: number;
  higherSkilled: number;
  basicSkilled: number;
  manYearsUsed: number;
  certGaps: number;
  potentialSaving: number;
}

export function myeSummary(rows: MyeRow[]): MyeSummary {
  const higher = rows.filter((r) => r.skillLevel === "Higher Skilled");
  const basic = rows.filter((r) => r.skillLevel === "Basic Skilled");
  return {
    workers: rows.length,
    higherSkilled: higher.length,
    basicSkilled: basic.length,
    manYearsUsed: rows.reduce((s, r) => s + r.manYears, 0),
    certGaps: rows.filter((r) => r.issues.some((i) => i.severity === "critical")).length,
    potentialSaving: basic.length * HIGHER_SKILLED_LEVY_SAVING,
  };
}