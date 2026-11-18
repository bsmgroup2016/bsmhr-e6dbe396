import type { Attendance, LeaveRequest, PayrollEntry } from "@/lib/types";

const r2 = (n: number) => Math.round(n * 100) / 100;
const WORKED = new Set(["Present", "Half Day"]);

/** Payslips whose month (YYYY-MM) is within [from, to], newest first, with totals. */
export function payslipsInRange(all: PayrollEntry[], from: string, to: string) {
  const lo = from && to && from > to ? to : from;
  const hi = from && to && from > to ? from : to;
  const rows = all
    .filter((p) => (!lo || p.month >= lo) && (!hi || p.month <= hi))
    .sort((a, b) => b.month.localeCompare(a.month));
  const sum = (f: (p: PayrollEntry) => number) => r2(rows.reduce((s, p) => s + (f(p) || 0), 0));
  return {
    rows,
    months: rows.length,
    gross: sum((p) => p.basicSalary + p.overtimePay + p.allowances),
    deductions: sum((p) => p.deductions + p.cpfEmployee),
    net: sum((p) => p.netPay),
    otHours: sum((p) => p.overtimeHours ?? 0),
  };
}

/** Leave requests starting in a year (and optionally a month 1-12), with counts by status. */
export function leaveSummary(all: LeaveRequest[], year: number, month?: number) {
  const prefix = month ? `${year}-${String(month).padStart(2, "0")}` : String(year);
  const rows = all.filter((l) => l.startDate.startsWith(prefix)).sort((a, b) => b.startDate.localeCompare(a.startDate));
  const by = (s: string) => rows.filter((l) => l.status === s);
  return {
    rows,
    requested: rows.length,
    approved: by("Approved").length,
    pending: by("Pending").length,
    rejected: by("Rejected").length,
    approvedDays: by("Approved").reduce((s, l) => s + (l.days || 0), 0),
  };
}

/** Monday–Sunday (YYYY-MM-DD) of the week containing date. */
export function weekRange(date: string): { from: string; to: string } {
  const d = new Date(`${date}T00:00:00Z`);
  const offset = (d.getUTCDay() + 6) % 7;
  const start = new Date(d.getTime() - offset * 86400000);
  const end = new Date(start.getTime() + 6 * 86400000);
  return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
}

/** Attendance between two dates inclusive, newest first, with totals. */
export function rangeAttendance(all: Attendance[], from: string, to: string) {
  const rows = all.filter((a) => a.date >= from && a.date <= to).sort((a, b) => b.date.localeCompare(a.date));
  const sum = (f: (a: Attendance) => number) => r2(rows.reduce((s, a) => s + (f(a) || 0), 0));
  return {
    rows,
    daysWorked: rows.filter((a) => WORKED.has(a.status)).length,
    absent: rows.filter((a) => a.status === "Absent").length,
    leave: rows.filter((a) => a.status === "On Leave" || a.status === "MC").length,
    normalHours: sum((a) => a.hoursWorked),
    otHours: sum((a) => a.overtimeHours),
  };
}
