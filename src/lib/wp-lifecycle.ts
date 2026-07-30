/**
 * Work Permit lifecycle (MOM, Singapore).
 *
 * Tracks a foreign worker from In-Principle Approval through arrival, medical
 * clearance, card issuance, cancellation and repatriation, and flags the
 * statutory deadlines an employer must meet:
 *
 *  - IPA is valid for 6 months; the worker must enter Singapore before it lapses.
 *  - Medical examination must be completed within 14 days of arrival.
 *  - The Work Permit card must be issued/collected within 1 month of pass issue.
 *  - MOM must be notified within 1 day when employment ends.
 *  - The pass must be cancelled within 7 days of the last working day.
 *  - The worker must be repatriated within 7 days of cancellation.
 *  - A S$5,000 security bond is required for every non-Malaysian Work Permit holder.
 */
import type { Employee, WpStage } from "@/lib/types";
import { daysUntil } from "@/lib/compliance";

export const WP_STAGES: WpStage[] = [
  "IPA Issued",
  "Arrived",
  "Medical Cleared",
  "Card Issued",
  "Active",
  "Cancellation Pending",
  "Cancelled",
  "Repatriated",
];

/** MOM statutory deadlines, in days. */
export const WP_DEADLINES = {
  ipaValidityDays: 180,
  medicalAfterArrivalDays: 14,
  cardAfterIssueDays: 30,
  notifyAfterLastDayDays: 1,
  cancelAfterLastDayDays: 7,
  repatriateAfterCancelDays: 7,
} as const;

/** Statutory security bond per non-Malaysian Work Permit holder. */
export const SECURITY_BOND_AMOUNT = 5000;

const EXITING = ["Resigned", "Terminated", "Repatriated"];

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Derive the current lifecycle stage when it has not been set manually. */
export function deriveStage(e: Employee): WpStage {
  if (e.wpStage) return e.wpStage;
  if (e.repatriationDate || e.status === "Repatriated") return "Repatriated";
  if (e.cancellationDate) return "Cancelled";
  if (EXITING.includes(e.status) || e.lastWorkingDate) return "Cancellation Pending";
  if (e.status === "Active" || e.status === "Deployed") return "Active";
  if (e.wpCardCollectedDate || e.workPermitIssueDate) return "Card Issued";
  if (e.medicalCompletedDate) return "Medical Cleared";
  if (e.arrivalDate) return "Arrived";
  return "IPA Issued";
}

export type WpTaskSeverity = "overdue" | "due" | "ok";

export interface WpTask {
  label: string;
  dueDate: string;
  daysLeft: number;
  severity: WpTaskSeverity;
}

export interface WpLifecycleRow {
  employee: Employee;
  stage: WpStage;
  tasks: WpTask[];
  /** Worst task on the row, used for sorting and badges. */
  severity: WpTaskSeverity;
  bondRequired: boolean;
  bondOk: boolean;
}

function task(label: string, dueDate: string): WpTask {
  const daysLeft = daysUntil(dueDate) ?? 0;
  return {
    label,
    dueDate,
    daysLeft,
    severity: daysLeft < 0 ? "overdue" : daysLeft <= 7 ? "due" : "ok",
  };
}

/** Malaysians are exempt from the Work Permit security bond. */
export function bondRequiredFor(e: Employee): boolean {
  if (e.securityBondRequired != null) return e.securityBondRequired;
  if (e.passType !== "Work Permit") return false;
  return !/malays/i.test(e.nationality ?? "");
}

/** Outstanding lifecycle actions for one worker. */
export function lifecycleFor(e: Employee): WpLifecycleRow {
  const stage = deriveStage(e);
  const tasks: WpTask[] = [];

  if (stage === "IPA Issued") {
    const expiry = e.ipaExpiryDate
      || (e.ipaIssueDate ? addDays(e.ipaIssueDate, WP_DEADLINES.ipaValidityDays) : undefined);
    if (expiry) tasks.push(task("Worker must enter Singapore (IPA expiry)", expiry));
  }

  if (stage === "Arrived" && e.arrivalDate) {
    tasks.push(task("Complete medical examination", addDays(e.arrivalDate, WP_DEADLINES.medicalAfterArrivalDays)));
  }

  if ((stage === "Medical Cleared" || stage === "Card Issued") && e.workPermitIssueDate && !e.wpCardCollectedDate) {
    tasks.push(task("Issue / collect Work Permit card", addDays(e.workPermitIssueDate, WP_DEADLINES.cardAfterIssueDays)));
  }

  if (e.lastWorkingDate && !e.cancellationDate) {
    if (!e.cancellationNotifiedOn) {
      tasks.push(task("Notify MOM of employment ending", addDays(e.lastWorkingDate, WP_DEADLINES.notifyAfterLastDayDays)));
    }
    tasks.push(task("Cancel work pass with MOM", addDays(e.lastWorkingDate, WP_DEADLINES.cancelAfterLastDayDays)));
  }

  if (e.cancellationDate && !e.repatriationDate) {
    tasks.push(task("Repatriate worker", addDays(e.cancellationDate, WP_DEADLINES.repatriateAfterCancelDays)));
  }

  const bondRequired = bondRequiredFor(e);
  const bondDays = daysUntil(e.securityBondExpiry);
  const bondActive = e.securityBondStatus === "Active" || (!e.securityBondStatus && !!e.securityBondAmount);
  const bondOk = !bondRequired
    || (bondActive && (e.securityBondAmount ?? 0) >= SECURITY_BOND_AMOUNT && (bondDays === null || bondDays >= 0));
  if (bondRequired && !bondOk && !["Cancelled", "Repatriated"].includes(stage)) {
    tasks.push({
      label: e.securityBondAmount
        ? "Security bond expired or below S$5,000"
        : "Security bond not recorded (S$5,000)",
      dueDate: e.securityBondExpiry ?? "",
      daysLeft: bondDays ?? 0,
      severity: "overdue",
    });
  }

  const severity: WpTaskSeverity = tasks.some((t) => t.severity === "overdue")
    ? "overdue"
    : tasks.some((t) => t.severity === "due")
      ? "due"
      : "ok";

  return { employee: e, stage, tasks, severity, bondRequired, bondOk };
}

const rank: Record<WpTaskSeverity, number> = { overdue: 0, due: 1, ok: 2 };

/** Lifecycle rows for every foreign worker, worst first. */
export function lifecycleRows(employees: Employee[]): WpLifecycleRow[] {
  return employees
    .filter((e) => e.passType === "Work Permit" || e.passType === "S Pass")
    .map(lifecycleFor)
    .sort(
      (a, b) =>
        rank[a.severity] - rank[b.severity]
        || (a.tasks[0]?.daysLeft ?? 999) - (b.tasks[0]?.daysLeft ?? 999)
        || a.employee.name.localeCompare(b.employee.name),
    );
}

export interface WpLifecycleSummary {
  total: number;
  overdue: number;
  dueSoon: number;
  byStage: { stage: WpStage; count: number }[];
  bondGap: number;
  bondValue: number;
}

export function lifecycleSummary(rows: WpLifecycleRow[]): WpLifecycleSummary {
  return {
    total: rows.length,
    overdue: rows.filter((r) => r.severity === "overdue").length,
    dueSoon: rows.filter((r) => r.severity === "due").length,
    byStage: WP_STAGES.map((stage) => ({ stage, count: rows.filter((r) => r.stage === stage).length })),
    bondGap: rows.filter((r) => r.bondRequired && !r.bondOk).length,
    bondValue: rows
      .filter((r) => r.bondRequired)
      .reduce((s, r) => s + (r.employee.securityBondAmount ?? SECURITY_BOND_AMOUNT), 0),
  };
}