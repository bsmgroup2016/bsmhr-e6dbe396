import { z } from "zod";
import type { Employee } from "@/lib/types";

export const ONBOARD_STAGES = ["IPA registered", "Onboard booked", "At Onboard", "Onboard completed", "MOM appointment booked", "Work Permit issued"] as const;
const date = z.string().refine(v => !v || /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v, "Use a valid date (YYYY-MM-DD)");
export const onboardingSchema = z.object({
  stage: z.enum(ONBOARD_STAGES),
  bookingDate: date.default(""),
  centre: z.string().trim().max(200).default(""),
  completedDate: date.default(""),
  appointmentDate: date.default(""),
  appointmentReference: z.string().trim().max(100).default(""),
  notes: z.string().trim().max(2000).default(""),
}).superRefine((v, ctx) => {
  if (v.stage !== "IPA registered" && !v.bookingDate) ctx.addIssue({ code: "custom", path: ["bookingDate"], message: "Enter the Onboard booking date" });
  if (ONBOARD_STAGES.indexOf(v.stage) >= 3 && !v.completedDate) ctx.addIssue({ code: "custom", path: ["completedDate"], message: "Enter the Onboard completion date" });
  if (v.stage === "MOM appointment booked" && !v.appointmentDate) ctx.addIssue({ code: "custom", path: ["appointmentDate"], message: "Enter the MOM appointment date" });
  if (v.completedDate && v.bookingDate && v.completedDate < v.bookingDate) ctx.addIssue({ code: "custom", message: "Completion cannot precede the booking date" });
  if (v.completedDate && ONBOARD_STAGES.indexOf(v.stage) < 3) ctx.addIssue({ code: "custom", message: "Choose Onboard completed or a later stage to confirm completion" });
});
export type Onboarding = z.infer<typeof onboardingSchema>;
export const newOnboarding = (): Onboarding => ({ stage: "IPA registered", bookingDate: "", centre: "", completedDate: "", appointmentDate: "", appointmentReference: "", notes: "" });

// A small, versioned structured record in the existing internal_notes column.
// Free-text notes remain untouched outside this bounded marker.
const marker = /\n?\[BSM_ONBOARD_V1\]([^\n]*)\[\/BSM_ONBOARD_V1\]/;
export function readOnboarding(employee: Pick<Employee, "internalNotes">): Onboarding | undefined {
  const match = marker.exec(employee.internalNotes ?? "");
  if (!match) return undefined;
  try { return onboardingSchema.parse(JSON.parse(match[1])); } catch { return undefined; }
}
export function hasOnboarding(employee: Pick<Employee, "internalNotes">): boolean { return (employee.internalNotes ?? "").includes("[BSM_ONBOARD_V1]"); }
export function writeOnboarding(notes: string | undefined, input: Onboarding): string {
  const data = onboardingSchema.parse(input);
  const text = (notes ?? "").replace(marker, "");
  return `${text}${text ? "\n" : ""}[BSM_ONBOARD_V1]${JSON.stringify(data)}[/BSM_ONBOARD_V1]`;
}
export function onboardingIncomplete(employee: Pick<Employee, "internalNotes">): boolean {
  return hasOnboarding(employee) && !readOnboarding(employee)?.completedDate;
}
export function onboardingEmployeePatch(employee: Partial<Employee>, input: Onboarding): Partial<Employee> {
  const data = onboardingSchema.parse(input);
  if (data.stage === "Work Permit issued" && (!employee.workPermitNumber?.trim() || !employee.workPermitIssueDate || !employee.workPermitExpiryDate)) throw new Error("Enter the actual Work Permit number, issue date and expiry date before confirming issuance");
  if (employee.workPermitIssueDate) date.parse(employee.workPermitIssueDate);
  if (employee.workPermitExpiryDate) date.parse(employee.workPermitExpiryDate);
  if (employee.workPermitIssueDate && employee.workPermitExpiryDate && employee.workPermitExpiryDate < employee.workPermitIssueDate) throw new Error("Work Permit expiry cannot precede its issue date");
  return { internalNotes: writeOnboarding(employee.internalNotes, data), ...(!data.completedDate ? { status: "Pending Approval", deploymentStatus: "Not Deployable" } : { status: employee.status === "Pending Approval" || !employee.status ? "Active" : employee.status, deploymentStatus: employee.deploymentStatus === "Not Deployable" || !employee.deploymentStatus ? "Available" : employee.deploymentStatus }), ...(data.stage === "Work Permit issued" ? { passExpiry: employee.workPermitExpiryDate } : {}) };
}