import { z } from "zod";
import type { Employee } from "@/lib/types";
import type { ImportColumn } from "@/lib/xlsx";

const date = z.string().trim().refine(v => !v || /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v, "Use a valid YYYY-MM-DD date");
export const permitSchema = z.object({
  workPermitNumber: z.string().trim().max(100).optional(), workPermitIssueDate: date.optional(), workPermitExpiryDate: date.optional(),
  passportNumber: z.string().trim().max(100).optional(), passportExpiry: date.optional(),
  medicalInsuranceExpiry: date.optional(), medicalCheckupDue: date.optional(), safetyCourseNo: z.string().trim().max(100).optional(), safetyCourseExpiry: date.optional(),
}).strict().superRefine((v, ctx) => {
  if (v.workPermitIssueDate && v.workPermitExpiryDate && v.workPermitExpiryDate < v.workPermitIssueDate) ctx.addIssue({ code: "custom", message: "Permit expiry cannot precede the issue date" });
});
export type PermitUpdate = z.infer<typeof permitSchema>;
export const PERMIT_FIELDS = [
  ["workPermitNumber", "Work Permit Number", "text"], ["workPermitIssueDate", "Work Permit Issue Date", "date"], ["workPermitExpiryDate", "Work Permit Expiry Date", "date"],
  ["passportNumber", "Passport Number", "text"], ["passportExpiry", "Passport Expiry Date", "date"], ["medicalInsuranceExpiry", "Medical Insurance Expiry", "date"],
  ["medicalCheckupDue", "Medical Examination Due", "date"], ["safetyCourseNo", "CSOC Number", "text"], ["safetyCourseExpiry", "CSOC Expiry Date", "date"],
] as const;
export const PERMIT_COLUMNS: ImportColumn[] = [{ key: "employeeCode", label: "P-File Number" }, { key: "fin", label: "FIN" }, ...PERMIT_FIELDS.map(([key, label]) => ({ key, label }))];
const normal = (v: string) => v.trim().toUpperCase().replace(/[\s-]/g, "");
export function preparePermitImport(row: Record<string, string>, employees: Employee[]) {
  const code = row["p-file number"]?.trim() ?? "", fin = row.fin?.trim() ?? "";
  if (!code && !fin) throw new Error("Supply P-File Number or FIN to match an existing worker");
  const matches = employees.filter(e => (code && normal(e.employeeCode) === normal(code)) || (fin && normal(e.fin) === normal(fin)));
  if (matches.length !== 1) throw new Error(matches.length ? "Identifiers match different workers" : "Worker not found; register the worker first");
  const employee = matches[0];
  if ((code && normal(employee.employeeCode) !== normal(code)) || (fin && normal(employee.fin) !== normal(fin))) throw new Error("P-File Number and FIN do not match the same worker");
  const patch = permitSchema.parse(Object.fromEntries(PERMIT_FIELDS.flatMap(([key, label]) => {
    const value = row[label.toLowerCase()]?.trim(); return value ? [[key, value]] : [];
  })));
  if (!Object.keys(patch).length) throw new Error("No permit or compliance details supplied");
  permitSchema.parse({ workPermitIssueDate: employee.workPermitIssueDate, workPermitExpiryDate: employee.workPermitExpiryDate, ...patch });
  return { employee, patch };
}

export function permitStatus(employee: Employee, today: string) {
  const expiry = employee.workPermitExpiryDate || (employee.passExpiry !== "-" ? employee.passExpiry : "");
  if (!expiry) return "Missing expiry";
  if (expiry < today) return "Expired";
  const days = Math.round((Date.parse(expiry) - Date.parse(today)) / 86400000);
  return days <= 30 ? "Due within 30 days" : days <= 90 ? "Due within 90 days" : "Valid";
}