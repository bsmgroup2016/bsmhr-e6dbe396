import type { EmployeeDocument } from "@/lib/types";

export type PendingEmployeeDocument = Omit<EmployeeDocument, "id" | "employeeId" | "uploadedAt" | "updatedAt">;
export function employeeFormDocuments(fd: FormData): PendingEmployeeDocument[] {
  const value = (key: string) => String(fd.get(key) ?? "").trim();
  return ([
    ["passportUpload", "Passport", "passportExpiry", "passportNumber"],
    ["workPermitUpload", "Work Permit", "workPermitExpiryDate", "workPermitNumber"],
    ["csocUpload", "Safety Certificate", "safetyCourseExpiry", "safetyCourseNo"],
  ] as const).flatMap(([field, type, expiry, number]) => {
    const fileUrl = value(field);
    return fileUrl ? [{ type, name: type, fileUrl, expiryDate: value(expiry) || undefined, docNumber: value(number) || undefined, status: "Pending" as const, verified: false }] : [];
  });
}