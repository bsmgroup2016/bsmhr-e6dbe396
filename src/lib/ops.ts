import type { Assignment, Attendance, Employee, PayrollEntry, Project, Site } from "@/lib/types";

/** Manpower fulfilment for a project: required vs actively deployed workers. */
export function projectFulfilment(project: Project, sites: Site[], assignments: Assignment[]) {
  const siteIds = sites.filter((s) => s.projectId === project.id).map((s) => s.id);
  const deployed = assignments.filter(
    (a) =>
      (a.projectId === project.id || (a.siteId && siteIds.includes(a.siteId))) &&
      (a.status === "Active" || a.status === "Approved"),
  ).length;
  const required = project.requiredWorkers || 0;
  const gap = required - deployed;
  const percent = required > 0 ? Math.min(100, Math.round((deployed / required) * 100)) : 0;
  return { required, deployed, gap, percent };
}

export type MonthlySummaryRow = {
  employeeId: string;
  presentDays: number;
  absentDays: number;
  leaveDays: number;
  normalHours: number;
  otHours: number;
  totalHours: number;
};

/** Per-employee attendance totals for a YYYY-MM month. */
export function monthlyAttendanceSummary(
  attendance: Attendance[],
  month: string,
  employeeIds?: string[],
): MonthlySummaryRow[] {
  const rows = attendance.filter(
    (a) => a.date.startsWith(month) && (!employeeIds || employeeIds.includes(a.employeeId)),
  );
  const map = new Map<string, MonthlySummaryRow>();
  for (const a of rows) {
    const row =
      map.get(a.employeeId) ??
      {
        employeeId: a.employeeId,
        presentDays: 0,
        absentDays: 0,
        leaveDays: 0,
        normalHours: 0,
        otHours: 0,
        totalHours: 0,
      };
    if (a.status === "Present") row.presentDays += 1;
    else if (a.status === "Half Day") row.presentDays += 0.5;
    else if (a.status === "Absent" || a.status === "MC") row.absentDays += 1;
    else if (a.status === "On Leave" || a.status === "Off" || a.status === "Public Holiday")
      row.leaveDays += 1;
    row.normalHours += a.hoursWorked || 0;
    row.otHours += a.overtimeHours || 0;
    row.totalHours = row.normalHours + row.otHours;
    map.set(a.employeeId, row);
  }
  return [...map.values()];
}

/** GIRO-style bank payment rows for approved payroll entries. */
export function bankFileRows(entries: PayrollEntry[], employees: Employee[]) {
  return entries.map((p) => {
    const emp = employees.find((e) => e.id === p.employeeId);
    return {
      "Employee Code": emp?.employeeCode ?? "",
      "Payee Name": emp?.name ?? "",
      "Bank Name": emp?.bankName ?? "",
      "Account Number": emp?.bankAccount ?? "",
      Currency: "SGD",
      Amount: p.netPay.toFixed(2),
      Reference: `SALARY ${p.month}`,
    };
  });
}