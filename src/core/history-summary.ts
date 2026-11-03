import type { HistorySummary, WorkerLedger } from "@/lib/history-data";

export function summarizeHistory(table: string, rows: Record<string, any>[], total: number, today: string): HistorySummary {
  const summary: HistorySummary = { total, counts: {}, hours: 0, ot: 0, overdue: 0, replacement: 0, unacknowledged: 0, recovery: 0, issuedQuantity: {}, workers: [], attendanceWorkers: [] };
  const workers = new Map<string, WorkerLedger>();
  const attendance = new Map<string, HistorySummary["attendanceWorkers"][number]>();
  for (const row of rows) {
    const status = String(row.status);
    summary.counts[status] = (summary.counts[status] ?? 0) + 1;
    if (table === "attendance") {
      const hours = Number(row.hours_worked ?? 0), ot = Number(row.overtime_hours ?? 0);
      summary.hours += hours; summary.ot += ot;
      const w = attendance.get(row.employee_id) ?? { employeeId: row.employee_id, presentDays: 0, absentDays: 0, leaveDays: 0, normalHours: 0, otHours: 0, totalHours: 0 };
      if (["Present", "Half Day"].includes(status)) w.presentDays += status === "Half Day" ? 0.5 : 1;
      if (["Absent", "MC"].includes(status)) w.absentDays++;
      if (["On Leave", "Off", "Public Holiday"].includes(status)) w.leaveDays++;
      w.normalHours += hours; w.otHours += ot; w.totalHours += hours + ot;
      attendance.set(row.employee_id, w);
      continue;
    }
    const held = status === "Issued", quantity = Number(row.quantity ?? 0), recovery = Number(row.cost_recovery ?? 0);
    const overdue = held && row.due_date && row.due_date < today;
    const replacement = held && row.replacement_due && row.replacement_due <= today;
    const unack = held && !row.acknowledged;
    if (overdue) summary.overdue++;
    if (replacement) summary.replacement++;
    if (unack) summary.unacknowledged++;
    summary.recovery += recovery;
    if (held) summary.issuedQuantity[row.asset_id] = (summary.issuedQuantity[row.asset_id] ?? 0) + quantity;
    const w = workers.get(row.employee_id) ?? { employeeId: row.employee_id, total: 0, holding: 0, lastIssue: "", pendingAck: 0, dueReplacement: 0, lost: 0, value: 0, recovery: 0 };
    w.total++; w.holding += held ? quantity : 0; w.lastIssue = row.issue_date > w.lastIssue ? row.issue_date : w.lastIssue;
    w.pendingAck += unack ? 1 : 0; w.dueReplacement += replacement ? 1 : 0;
    w.lost += ["Lost", "Damaged"].includes(status) ? 1 : 0; w.recovery += recovery;
    w.value += held ? quantity * Number(row.assets?.unit_cost ?? 0) : 0;
    workers.set(row.employee_id, w);
  }
  summary.workers = [...workers.values()]; summary.attendanceWorkers = [...attendance.values()];
  return summary;
}