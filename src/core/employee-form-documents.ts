import type { EmployeeDocument } from "@/lib/types";

export type PendingEmployeeDocument = Omit<EmployeeDocument, "id" | "employeeId" | "uploadedAt" | "updatedAt">;

const FORM_DOCUMENTS = [
  ["passportUpload", "Passport", "passportExpiry", "passportNumber"],
  ["workPermitUpload", "Work Permit", "workPermitExpiryDate", "workPermitNumber"],
  ["csocUpload", "Safety Certificate", "safetyCourseExpiry", "safetyCourseNo"],
  ["bankCardUpload", "Bank Letter", "", "bankAccount"],
] as const;

export type FormDocumentField = (typeof FORM_DOCUMENTS)[number][0];

/** Uploaded files in the form that are not already stored for this employee. */
export function employeeFormDocuments(fd: FormData, existing: Pick<EmployeeDocument, "fileUrl">[] = []): PendingEmployeeDocument[] {
  const value = (key: string) => String(fd.get(key) ?? "").trim();
  const stored = new Set(existing.map((d) => d.fileUrl).filter(Boolean));
  return FORM_DOCUMENTS.flatMap(([field, type, expiry, number]) => {
    const fileUrl = value(field);
    return fileUrl && !stored.has(fileUrl) ? [{ type, name: field === "bankCardUpload" ? "Bank Card" : type, fileUrl, expiryDate: value(expiry) || undefined, docNumber: value(number) || undefined, status: "Pending" as const, verified: false }] : [];
  });
}

/** Latest stored file per form upload field, so saved documents show again when editing. */
export function storedFormDocumentUrls(documents: Pick<EmployeeDocument, "type" | "fileUrl" | "uploadedAt">[]): Partial<Record<FormDocumentField, string>> {
  const out: Partial<Record<FormDocumentField, string>> = {};
  const sorted = [...documents].sort((a, b) => String(b.uploadedAt ?? "").localeCompare(String(a.uploadedAt ?? "")));
  for (const [field, type] of FORM_DOCUMENTS) {
    const hit = sorted.find((d) => d.type === type && d.fileUrl && (field !== "bankCardUpload" || d.name === "Bank Card"));
    if (hit) out[field] = hit.fileUrl;
  }
  return out;
}

export function employeeDocumentSection(document: Pick<EmployeeDocument, "type" | "name">): string {
  if (document.type === "IPA Letter" || document.type === "In-Principle Approval") return "IPA";
  if (document.type === "P-File") return "Particular";
  if (document.type === "Safety Certificate") return "CSOC";
  if (document.type === "Bank Letter" && /bank\s*card/i.test(document.name)) return "Bank Card";
  return document.type;
}
