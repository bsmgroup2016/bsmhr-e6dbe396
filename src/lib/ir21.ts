/**
 * IR21 tax clearance (IRAS).
 *
 * An employer must file Form IR21 at least one month before a non-Singaporean
 * employee stops working, goes on overseas posting, or leaves Singapore for
 * more than three months, and must withhold all monies due until IRAS issues
 * the clearance directive.
 */
import type { Employee, Ir21Status } from "@/lib/types";
import { daysUntil } from "@/lib/compliance";

/** Days before the last working day the IR21 must be filed. */
export const IR21_FILE_BEFORE_DAYS = 30;

export const IR21_STATUSES: Ir21Status[] = ["Not Required", "Pending", "Filed", "Cleared"];

const LEAVING = ["Resigned", "Terminated", "Repatriated"];

/** IR21 applies to foreign employees (not Singaporeans / PRs). */
export function ir21Applies(e: Employee): boolean {
  if (e.ir21Required != null) return e.ir21Required;
  if (e.passType === "Singaporean/PR") return false;
  if (e.prStatus && e.prStatus !== "Citizen") return false;
  return true;
}

export type Ir21Severity = "overdue" | "due" | "ok" | "done";

export interface Ir21Row {
  employee: Employee;
  status: Ir21Status;
  /** Date the IR21 should be filed by. */
  dueDate?: string;
  daysLeft: number | null;
  severity: Ir21Severity;
  note: string;
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function ir21For(e: Employee): Ir21Row {
  const status: Ir21Status = e.ir21Status ?? (e.ir21FiledOn ? "Filed" : "Pending");
  const dueDate = e.lastWorkingDate ? addDays(e.lastWorkingDate, -IR21_FILE_BEFORE_DAYS) : undefined;
  const daysLeft = daysUntil(dueDate);

  if (status === "Cleared") {
    return { employee: e, status, dueDate, daysLeft, severity: "done", note: "Tax clearance received" };
  }
  if (status === "Filed") {
    return {
      employee: e, status, dueDate, daysLeft, severity: "done",
      note: `Filed on ${e.ir21FiledOn ?? "—"} — hold monies until IRAS clears`,
    };
  }
  if (!dueDate) {
    return { employee: e, status, dueDate, daysLeft, severity: "ok", note: "No last working day recorded yet" };
  }
  if (daysLeft != null && daysLeft < 0) {
    return {
      employee: e, status, dueDate, daysLeft, severity: "overdue",
      note: `IR21 late by ${Math.abs(daysLeft)} days — file immediately`,
    };
  }
  return {
    employee: e, status, dueDate, daysLeft, severity: "due",
    note: `File IR21 by ${dueDate} (one month before the last working day)`,
  };
}

/** Departing foreign employees needing tax clearance. */
export function ir21Rows(employees: Employee[]): Ir21Row[] {
  const rank: Record<Ir21Severity, number> = { overdue: 0, due: 1, ok: 2, done: 3 };
  return employees
    .filter((e) => ir21Applies(e) && (!!e.lastWorkingDate || LEAVING.includes(e.status) || !!e.cancellationDate))
    .map(ir21For)
    .sort((a, b) => rank[a.severity] - rank[b.severity] || a.employee.name.localeCompare(b.employee.name));
}

export interface Ir21Summary {
  total: number;
  overdue: number;
  due: number;
  filed: number;
  cleared: number;
  withheld: number;
}

export function ir21Summary(rows: Ir21Row[]): Ir21Summary {
  return {
    total: rows.length,
    overdue: rows.filter((r) => r.severity === "overdue").length,
    due: rows.filter((r) => r.severity === "due").length,
    filed: rows.filter((r) => r.status === "Filed").length,
    cleared: rows.filter((r) => r.status === "Cleared").length,
    withheld: rows
      .filter((r) => r.status !== "Cleared")
      .reduce((s, r) => s + (r.employee.ir21AmountWithheld ?? 0), 0),
  };
}