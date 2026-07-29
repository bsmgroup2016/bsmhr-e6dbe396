/**
 * Unified alert feed. Collects time-critical signals from every module
 * (compliance, leave, billing, transport, assets, training, approvals)
 * into one prioritised list used by the header bell and the Alerts page.
 */
import { buildComplianceItems } from "@/lib/compliance";
import {
  assetAlerts,
  certificationAlerts,
  getApprovals,
  getDocuments,
  getEmployees,
  getInvoices,
  getLeaveRequests,
  overdueIssuances,
  vehicleExpiryAlerts,
} from "@/lib/store";

export type AlertSeverity = "critical" | "warning" | "info";

export type AlertCategory =
  | "Compliance"
  | "Leave"
  | "Billing"
  | "Transport"
  | "Assets"
  | "Training"
  | "Approvals";

export interface AppAlert {
  id: string;
  category: AlertCategory;
  severity: AlertSeverity;
  title: string;
  detail: string;
  date?: string;
  link: string;
}

const today = () => new Date().toISOString().slice(0, 10);

function daysLabel(date: string) {
  const diff = Math.round(
    (new Date(`${date}T00:00:00`).getTime() - new Date(`${today()}T00:00:00`).getTime()) / 86400000,
  );
  if (diff < 0) return `${Math.abs(diff)} days overdue`;
  if (diff === 0) return "due today";
  return `in ${diff} days`;
}

/** Build the full alert list, optionally scoped to one company. */
export function buildAlerts(companyId?: string): AppAlert[] {
  const out: AppAlert[] = [];
  const scoped = <T extends { companyId?: string }>(rows: T[]) =>
    companyId ? rows.filter((r) => !r.companyId || r.companyId === companyId) : rows;

  // Work passes, passports and expiring documents
  const employees = scoped(getEmployees());
  for (const item of buildComplianceItems(employees, getDocuments())) {
    if (item.severity === "ok" || item.severity === "warning") continue;
    out.push({
      id: `compliance-${item.id}`,
      category: "Compliance",
      severity: item.severity === "expired" ? "critical" : "warning",
      title: `${item.label} — ${item.employeeName}`,
      detail: item.severity === "expired" ? "Expired" : `Expires ${daysLabel(item.expiryDate)}`,
      date: item.expiryDate,
      link: "/compliance",
    });
  }

  // Pending leave requests
  for (const leave of getLeaveRequests().filter((l) => l.status === "Pending")) {
    const emp = employees.find((e) => e.id === leave.employeeId);
    if (companyId && !emp) continue;
    out.push({
      id: `leave-${leave.id}`,
      category: "Leave",
      severity: "info",
      title: `${leave.type} leave awaiting approval`,
      detail: `${emp?.name ?? "Employee"} — ${leave.days} day(s) from ${leave.startDate}`,
      date: leave.startDate,
      link: "/leave",
    });
  }

  // Overdue and unpaid invoices
  for (const inv of scoped(getInvoices())) {
    if (inv.status === "Paid" || inv.status === "Cancelled") continue;
    if (inv.dueDate >= today()) continue;
    out.push({
      id: `invoice-${inv.id}`,
      category: "Billing",
      severity: "critical",
      title: `Invoice ${inv.invoiceNo} overdue`,
      detail: `S$${(inv.total - inv.amountPaid).toFixed(2)} outstanding, ${daysLabel(inv.dueDate)}`,
      date: inv.dueDate,
      link: "/billing",
    });
  }

  // Vehicle road tax / insurance / inspection
  for (const v of vehicleExpiryAlerts()) {
    if (companyId && v.vehicle.companyId && v.vehicle.companyId !== companyId) continue;
    out.push({
      id: `vehicle-${v.vehicle.id}-${v.label}`,
      category: "Transport",
      severity: v.expired ? "critical" : "warning",
      title: `${v.label} — ${v.vehicle.plateNo}`,
      detail: v.expired ? "Expired" : `Due ${daysLabel(v.date)}`,
      date: v.date,
      link: "/transport",
    });
  }

  // Asset warranty / calibration and overdue issuances
  for (const a of assetAlerts()) {
    if (companyId && a.asset.companyId && a.asset.companyId !== companyId) continue;
    out.push({
      id: `asset-${a.asset.id}-${a.label}`,
      category: "Assets",
      severity: a.expired ? "critical" : "warning",
      title: `${a.label} — ${a.asset.name}`,
      detail: a.expired ? "Expired" : `Due ${daysLabel(a.date)}`,
      date: a.date,
      link: "/assets",
    });
  }
  for (const i of overdueIssuances()) {
    const emp = employees.find((e) => e.id === i.employeeId);
    if (companyId && !emp) continue;
    out.push({
      id: `issuance-${i.id}`,
      category: "Assets",
      severity: "warning",
      title: "Issued item not returned",
      detail: `${emp?.name ?? "Employee"} — due ${i.dueDate}`,
      date: i.dueDate,
      link: "/assets",
    });
  }

  // Expiring certifications
  for (const c of certificationAlerts()) {
    const emp = employees.find((e) => e.id === c.training.employeeId);
    if (companyId && !emp) continue;
    out.push({
      id: `cert-${c.training.id}`,
      category: "Training",
      severity: c.expired ? "critical" : "warning",
      title: `Certification ${c.expired ? "expired" : "expiring"}`,
      detail: `${emp?.name ?? "Employee"} — ${daysLabel(c.date)}`,
      date: c.date,
      link: "/training",
    });
  }

  // Pending approvals
  for (const a of getApprovals().filter((x) => x.status === "Pending")) {
    out.push({
      id: `approval-${a.id}`,
      category: "Approvals",
      severity: "info",
      title: a.title,
      detail: `Requested by ${a.requestedByName}`,
      date: a.requestedAt.slice(0, 10),
      link: "/approvals",
    });
  }

  const rank: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 };
  return out.sort(
    (a, b) => rank[a.severity] - rank[b.severity] || (a.date ?? "").localeCompare(b.date ?? ""),
  );
}

export function alertCounts(alerts: AppAlert[]) {
  return {
    total: alerts.length,
    critical: alerts.filter((a) => a.severity === "critical").length,
    warning: alerts.filter((a) => a.severity === "warning").length,
    info: alerts.filter((a) => a.severity === "info").length,
  };
}

export const ALERT_CATEGORIES: AlertCategory[] = [
  "Compliance",
  "Leave",
  "Billing",
  "Transport",
  "Assets",
  "Training",
  "Approvals",
];