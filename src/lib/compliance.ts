import { supabase } from "@/integrations/supabase/client";
import type { Employee, EmployeeDocument } from "./types";

export type ComplianceSeverity = "ok" | "warning" | "critical" | "expired";

export interface ComplianceItem {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  companyId?: string;
  category: "Work Pass" | "Passport" | "Document" | "Medical" | "Safety";
  label: string;
  reference?: string;
  expiryDate: string;
  daysLeft: number;
  severity: ComplianceSeverity;
  fileUrl?: string;
}

export const severityLabel: Record<ComplianceSeverity, string> = {
  ok: "Valid",
  warning: "Expiring (90d)",
  critical: "Critical (30d)",
  expired: "Expired",
};

export const severityVariant: Record<ComplianceSeverity, "success" | "warning" | "destructive" | "default"> = {
  ok: "success",
  warning: "default",
  critical: "warning",
  expired: "destructive",
};

export const DEFAULT_REMINDER_DAYS = 30;

export function daysUntil(dateStr?: string): number {
  if (!dateStr || dateStr === "-") return 9999;
  const t = new Date(`${dateStr}T23:59:59+08:00`).getTime();
  if (Number.isNaN(t)) return 9999;
  return Math.ceil((t - Date.now()) / 86400000);
}

export function computeDocumentStatus(expiryDate?: string, reminderDays = DEFAULT_REMINDER_DAYS): ComplianceSeverity {
  const days = daysUntil(expiryDate);
  if (days < 0) return "expired";
  if (days <= reminderDays) return "critical";
  if (days <= 90) return "warning";
  return "ok";
}

export function severityFor(days: number): ComplianceSeverity {
  if (days < 0) return "expired";
  if (days <= 14) return "critical";
  if (days <= 30) return "warning";
  return "ok";
}

export function reminderTier(days: number): number {
  if (days <= 0) return 0;
  if (days <= 7) return 7;
  if (days <= 14) return 14;
  if (days <= 30) return 30;
  return 90;
}

export function reminderLabel(days: number): string {
  if (days < 0) return `Expired ${Math.abs(days)} days ago`;
  if (days === 0) return "Expires today";
  return `Expires in ${days} days`;
}

export function buildComplianceItems(employees: Employee[], documents: EmployeeDocument[]): ComplianceItem[] {
  const items: ComplianceItem[] = [];

  for (const e of employees) {
    // Work Permit
    if (e.workPermitExpiryDate) {
      const days = daysUntil(e.workPermitExpiryDate);
      items.push({
        id: `wp-${e.id}`,
        employeeId: e.id,
        employeeName: e.name,
        employeeCode: e.employeeCode,
        companyId: e.companyId,
        category: "Work Pass",
        label: `${e.passType} Expiry`,
        reference: e.workPermitNumber,
        expiryDate: e.workPermitExpiryDate,
        daysLeft: days,
        severity: computeDocumentStatus(e.workPermitExpiryDate),
      });
    }

    // Passport
    if (e.passportExpiry) {
      const days = daysUntil(e.passportExpiry);
      items.push({
        id: `pp-${e.id}`,
        employeeId: e.id,
        employeeName: e.name,
        employeeCode: e.employeeCode,
        companyId: e.companyId,
        category: "Passport",
        label: "Passport Expiry",
        reference: e.passportNumber,
        expiryDate: e.passportExpiry,
        daysLeft: days,
        severity: computeDocumentStatus(e.passportExpiry, 60),
      });
    }

    // Safety Courses (from Employee table fields)
    if (e.safetyCourseExpiry) {
      const days = daysUntil(e.safetyCourseExpiry);
      items.push({
        id: `safety-${e.id}`,
        employeeId: e.id,
        employeeName: e.name,
        employeeCode: e.employeeCode,
        companyId: e.companyId,
        category: "Safety",
        label: `${e.safetyCourseType || "Safety Course"} Expiry`,
        reference: e.safetyCourseNo,
        expiryDate: e.safetyCourseExpiry,
        daysLeft: days,
        severity: computeDocumentStatus(e.safetyCourseExpiry),
      });
    }
  }

  // Documents
  for (const d of documents) {
    if (d.expiryDate) {
      const e = employees.find((x) => x.id === d.employeeId);
      if (!e) continue;
      items.push({
        id: `doc-${d.id}`,
        employeeId: d.employeeId,
        employeeName: e.name,
        employeeCode: e.employeeCode,
        companyId: e.companyId,
        category: d.type === "Passport" || d.type === "Work Permit" ? "Work Pass" : "Document",
        label: d.name,
        reference: d.docNumber,
        expiryDate: d.expiryDate,
        daysLeft: daysUntil(d.expiryDate),
        severity: computeDocumentStatus(d.expiryDate, d.reminderDays || DEFAULT_REMINDER_DAYS),
        fileUrl: d.fileUrl,
      });
    }
  }

  return items.sort((a, b) => a.daysLeft - b.daysLeft);
}

/**
 * Compliance check for deployment readiness.
 * Checks for mandatory safety course expiry.
 */
export async function checkDeploymentCompliance(employeeId: string) {
  const { data: certs, error } = await supabase
    .from("employee_certifications")
    .select("*")
    .eq("employee_id", employeeId);

  if (error) {
    console.error("Error checking compliance:", error);
    return { compliant: false, error: "Unable to verify safety compliance." };
  }

  const mandatoryCourses = ["CSOC", "Construction Safety Orientation Course", "SCOS"];
  
  const missingOrExpired = mandatoryCourses.filter(courseName => {
    const cert = certs.find(c => c.course_name.toLowerCase().includes(courseName.toLowerCase()));
    if (!cert) return true;
    if (cert.expiry_date && new Date(cert.expiry_date) < new Date()) return true;
    return false;
  });

  return {
    compliant: missingOrExpired.length === 0,
    missingOrExpired
  };
}
