import type { Employee, EmployeeDocument, DocumentStatus } from "@/lib/types";

export const DEFAULT_REMINDER_DAYS = 60;

/** Whole days from today until an ISO date. Negative when already past. */
export function daysUntil(value?: string | null): number | null {
  if (!value || value === "-") return null;
  const target = new Date(value);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

/** Derive a document status from its expiry date and reminder window. */
export function computeDocumentStatus(
  expiryDate?: string,
  reminderDays: number = DEFAULT_REMINDER_DAYS,
  fallback: DocumentStatus = "Valid",
): DocumentStatus {
  const days = daysUntil(expiryDate);
  if (days === null) return fallback === "Superseded" ? fallback : fallback;
  if (days < 0) return "Expired";
  if (days <= reminderDays) return "Expiring Soon";
  return "Valid";
}

export type ComplianceSeverity = "expired" | "critical" | "warning" | "ok";

export interface ComplianceItem {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  companyId?: string;
  category: "Work Pass" | "Passport" | "Document";
  label: string;
  reference?: string;
  expiryDate: string;
  daysLeft: number;
  severity: ComplianceSeverity;
  fileUrl?: string;
}

export function severityFor(days: number): ComplianceSeverity {
  if (days < 0) return "expired";
  if (days <= 30) return "critical";
  if (days <= 90) return "warning";
  return "ok";
}

/** Flatten employee passes, passports and documents into one expiry list. */
export function buildComplianceItems(
  employees: Employee[],
  documents: EmployeeDocument[],
): ComplianceItem[] {
  const items: ComplianceItem[] = [];
  const active = (e: Employee) =>
    !["Archived", "Resigned", "Terminated", "Repatriated"].includes(e.status);

  for (const e of employees) {
    if (!active(e)) continue;
    const base = {
      employeeId: e.id,
      employeeName: e.name,
      employeeCode: e.employeeCode,
      companyId: e.companyId,
    };
    const pass = daysUntil(e.passExpiry);
    if (pass !== null) {
      items.push({
        ...base,
        id: `pass-${e.id}`,
        category: "Work Pass",
        label: e.passType,
        reference: e.workPermitNumber || e.fin,
        expiryDate: e.passExpiry,
        daysLeft: pass,
        severity: severityFor(pass),
      });
    }
    const passport = daysUntil(e.passportExpiry);
    if (passport !== null) {
      items.push({
        ...base,
        id: `passport-${e.id}`,
        category: "Passport",
        label: "Passport",
        reference: e.passportNumber,
        expiryDate: e.passportExpiry!,
        daysLeft: passport,
        severity: severityFor(passport),
      });
    }
  }

  const byId = new Map(employees.map((e) => [e.id, e]));
  for (const d of documents) {
    if (d.status === "Superseded") continue;
    const days = daysUntil(d.expiryDate);
    if (days === null) continue;
    const e = byId.get(d.employeeId);
    if (!e || !active(e)) continue;
    items.push({
      id: `doc-${d.id}`,
      employeeId: e.id,
      employeeName: e.name,
      employeeCode: e.employeeCode,
      companyId: e.companyId,
      category: "Document",
      label: `${d.type} — ${d.name}`,
      reference: d.docNumber,
      expiryDate: d.expiryDate!,
      daysLeft: days,
      severity: severityFor(days),
      fileUrl: d.fileUrl,
    });
  }

  return items.sort((a, b) => a.daysLeft - b.daysLeft);
}

export const severityLabel: Record<ComplianceSeverity, string> = {
  expired: "Expired",
  critical: "≤ 30 days",
  warning: "≤ 90 days",
  ok: "Valid",
};

export const severityVariant: Record<ComplianceSeverity, "destructive" | "warning" | "info" | "success"> = {
  expired: "destructive",
  critical: "destructive",
  warning: "warning",
  ok: "success",
};