import type { Attendance } from "@/lib/types";

export interface MonthAttendance { rows: Attendance[]; daysWorked: number; normalHours: number; otHours: number; absent: number; leave: number }

const WORKED = new Set(["Present", "Half Day"]);

/** Worker's own attendance for one month (YYYY-MM), newest first, with totals. */
export function monthAttendance(all: Attendance[], month: string): MonthAttendance {
  const rows = all.filter((a) => a.date.startsWith(month)).sort((a, b) => b.date.localeCompare(a.date));
  const sum = (f: (a: Attendance) => number) => Math.round(rows.reduce((s, a) => s + (f(a) || 0), 0) * 100) / 100;
  return {
    rows,
    daysWorked: rows.filter((a) => WORKED.has(a.status)).length,
    normalHours: sum((a) => a.hoursWorked),
    otHours: sum((a) => a.overtimeHours),
    absent: rows.filter((a) => a.status === "Absent").length,
    leave: rows.filter((a) => a.status === "On Leave" || a.status === "MC").length,
  };
}
