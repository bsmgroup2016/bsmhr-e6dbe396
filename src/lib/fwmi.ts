/**
 * Foreign Worker Medical Insurance (FWMI) — MOM requirement.
 *
 * Every Work Permit and S Pass holder must be covered by medical insurance for
 * inpatient care and day surgery. The statutory minimum annual coverage is
 * $15,000 for policies bought before 1 Jul 2023, and $60,000 for policies
 * starting on or after that date. We check against the higher figure when the
 * policy runs into the current period.
 */
import type { Employee } from "@/lib/types";
import { daysUntil } from "@/lib/compliance";

export const FWMI_MIN_COVERAGE_LEGACY = 15000;
export const FWMI_MIN_COVERAGE = 60000;
export const FWMI_NEW_RULE_FROM = "2023-07-01";

export function requiresFwmi(e: Employee): boolean {
  return e.passType === "Work Permit" || e.passType === "S Pass";
}

/** Minimum coverage that applies to this worker's policy. */
export function requiredCoverage(e: Employee): number {
  const start = e.medicalInsuranceExpiry;
  if (start && start < FWMI_NEW_RULE_FROM) return FWMI_MIN_COVERAGE_LEGACY;
  return FWMI_MIN_COVERAGE;
}

export type FwmiState = "Not required" | "Compliant" | "Under-insured" | "Expiring" | "Expired" | "Missing";

export interface FwmiRow {
  employee: Employee;
  state: FwmiState;
  required: number;
  coverage: number;
  daysLeft: number | null;
  note: string;
}

export function fwmiFor(e: Employee): FwmiRow {
  const required = requiredCoverage(e);
  const coverage = e.insuranceCoverage ?? 0;
  const daysLeft = daysUntil(e.medicalInsuranceExpiry);

  if (!requiresFwmi(e)) {
    return { employee: e, state: "Not required", required: 0, coverage, daysLeft, note: "Local / EP holder" };
  }
  if (!e.medicalInsuranceExpiry && !coverage) {
    return { employee: e, state: "Missing", required, coverage, daysLeft, note: "No policy recorded" };
  }
  if (daysLeft != null && daysLeft < 0) {
    return { employee: e, state: "Expired", required, coverage, daysLeft, note: `Policy expired ${Math.abs(daysLeft)} days ago` };
  }
  if (coverage < required) {
    return {
      employee: e, state: "Under-insured", required, coverage, daysLeft,
      note: `Coverage $${coverage.toLocaleString()} is below the $${required.toLocaleString()} minimum`,
    };
  }
  if (daysLeft != null && daysLeft <= 30) {
    return { employee: e, state: "Expiring", required, coverage, daysLeft, note: `Renew within ${daysLeft} days` };
  }
  return { employee: e, state: "Compliant", required, coverage, daysLeft, note: "Policy in order" };
}

const order: Record<FwmiState, number> = {
  Missing: 0, Expired: 1, "Under-insured": 2, Expiring: 3, Compliant: 4, "Not required": 5,
};

export function fwmiRows(employees: Employee[]): FwmiRow[] {
  return employees
    .filter(requiresFwmi)
    .map(fwmiFor)
    .sort((a, b) => order[a.state] - order[b.state] || a.employee.name.localeCompare(b.employee.name));
}

export interface FwmiSummary {
  total: number;
  compliant: number;
  gaps: number;
  expiring: number;
  insuredValue: number;
}

export function fwmiSummary(rows: FwmiRow[]): FwmiSummary {
  return {
    total: rows.length,
    compliant: rows.filter((r) => r.state === "Compliant").length,
    gaps: rows.filter((r) => r.state === "Missing" || r.state === "Expired" || r.state === "Under-insured").length,
    expiring: rows.filter((r) => r.state === "Expiring").length,
    insuredValue: rows.reduce((s, r) => s + (r.employee.insuranceCoverage ?? 0), 0),
  };
}