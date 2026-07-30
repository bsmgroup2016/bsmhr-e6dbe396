/**
 * Medical claim tracking for Work Permit / S Pass holders.
 *
 * Claims are settled against the worker's FWMI policy; anything the insurer
 * does not pay falls on the employer (the worker may only be charged for
 * non-work-related treatment, and never for a WICA work injury). We also warn
 * when claims made in the policy year approach the insured limit.
 */
import type { Employee, MedicalClaim, MedicalClaimStatus, MedicalClaimType } from "@/lib/types";
import { requiredCoverage, requiresFwmi } from "@/lib/fwmi";

export const CLAIM_TYPES: MedicalClaimType[] = [
  "Inpatient", "Day Surgery", "Outpatient", "Specialist", "Dental", "Work Injury", "Other",
];
export const CLAIM_STATUSES: MedicalClaimStatus[] = [
  "Draft", "Submitted", "Approved", "Rejected", "Paid",
];

/** Share of the insured limit above which we flag the worker. */
export const UTILISATION_WARN = 0.8;

export interface ClaimRow {
  claim: MedicalClaim;
  employeeName: string;
  employeeCode: string;
  /** Amount still unsettled by the insurer or the employer. */
  outstanding: number;
  issues: string[];
}

export function claimIssues(claim: MedicalClaim, employee?: Employee): string[] {
  const issues: string[] = [];
  const settled = claim.insurerPaid + claim.employerPaid + claim.employeePaid;
  if (claim.status === "Paid" && Math.round(settled) < Math.round(claim.totalAmount)) {
    issues.push("Marked paid but the bill is not fully settled");
  }
  if (claim.workInjury && claim.employeePaid > 0) {
    issues.push("Work injury cost charged to the worker — not allowed under WICA");
  }
  if (claim.workInjury && !claim.momReported) {
    issues.push("Work injury not yet reported to MOM");
  }
  if (employee && requiresFwmi(employee) && !claim.insurer && claim.status !== "Draft") {
    issues.push("No insurer recorded — FWMI policy should cover this claim");
  }
  if (claim.status === "Rejected" && claim.employerPaid === 0 && claim.totalAmount > 0) {
    issues.push("Insurer rejected the claim — employer settlement not recorded");
  }
  return issues;
}

export function claimRows(claims: MedicalClaim[], employees: Employee[]): ClaimRow[] {
  const byId = new Map(employees.map((e) => [e.id, e]));
  return claims
    .filter((c) => byId.has(c.employeeId))
    .map((claim) => {
      const employee = byId.get(claim.employeeId);
      const settled = claim.insurerPaid + claim.employerPaid + claim.employeePaid;
      return {
        claim,
        employeeName: employee?.name ?? "—",
        employeeCode: employee?.employeeCode ?? "—",
        outstanding: Math.max(0, Math.round((claim.totalAmount - settled) * 100) / 100),
        issues: claimIssues(claim, employee),
      };
    })
    .sort((a, b) =>
      (b.claim.treatmentDate ?? "").localeCompare(a.claim.treatmentDate ?? "") ||
      a.employeeName.localeCompare(b.employeeName));
}

export interface ClaimSummary {
  claims: number;
  billed: number;
  insurerPaid: number;
  employerPaid: number;
  employeePaid: number;
  outstanding: number;
  pending: number;
  workInjury: number;
  issues: number;
}

export function claimSummary(rows: ClaimRow[]): ClaimSummary {
  const sum = (f: (r: ClaimRow) => number) => Math.round(rows.reduce((s, r) => s + f(r), 0) * 100) / 100;
  return {
    claims: rows.length,
    billed: sum((r) => r.claim.totalAmount),
    insurerPaid: sum((r) => r.claim.insurerPaid),
    employerPaid: sum((r) => r.claim.employerPaid),
    employeePaid: sum((r) => r.claim.employeePaid),
    outstanding: sum((r) => r.outstanding),
    pending: rows.filter((r) => r.claim.status === "Submitted" || r.claim.status === "Draft").length,
    workInjury: rows.filter((r) => r.claim.workInjury).length,
    issues: rows.filter((r) => r.issues.length > 0).length,
  };
}

export interface UtilisationRow {
  employee: Employee;
  claimed: number;
  limit: number;
  ratio: number;
  nearLimit: boolean;
  overLimit: boolean;
}

/** Per-worker claim totals against the insured limit for the given policy year. */
export function utilisation(claims: MedicalClaim[], employees: Employee[], year?: string): UtilisationRow[] {
  const rows: UtilisationRow[] = [];
  for (const employee of employees) {
    if (!requiresFwmi(employee)) continue;
    const claimed = claims
      .filter((c) => c.employeeId === employee.id && c.status !== "Rejected")
      .filter((c) => !year || (c.treatmentDate ?? "").startsWith(year))
      .reduce((s, c) => s + c.totalAmount, 0);
    if (!claimed) continue;
    const limit = employee.insuranceCoverage || requiredCoverage(employee);
    const ratio = limit ? claimed / limit : 0;
    rows.push({
      employee,
      claimed: Math.round(claimed * 100) / 100,
      limit,
      ratio,
      nearLimit: ratio >= UTILISATION_WARN && ratio < 1,
      overLimit: ratio >= 1,
    });
  }
  return rows.sort((a, b) => b.ratio - a.ratio);
}