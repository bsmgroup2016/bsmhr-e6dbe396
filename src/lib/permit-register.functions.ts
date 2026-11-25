import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { permitSchema } from "@/core/permit-register";
import { hasOnboarding, readOnboarding, onboardingEmployeePatch } from "@/core/onboarding";
const sessionMiddleware = createMiddleware({ type: "function" }).client(async ({ next }) => {
  const { supabase } = await import("@/integrations/supabase/client");
  const { data } = await supabase.auth.getSession();
  return next({ headers: { Authorization: `Bearer ${data.session?.access_token ?? ""}` } });
});
export const savePermitDetails = createServerFn({ method: "POST" }).middleware([sessionMiddleware])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid(), patch: permitSchema }).parse(input))
  .handler(async ({ data }) => {
    const { requireAuth, requireRole, sbRest } = await import("@/lib/api-v1.server");
    const auth = await requireAuth(getRequest());
    if ("response" in auth) throw new Error("Sign in before updating permit details");
    if (requireRole(auth.ctx, ["admin", "manager", "hr"])) throw new Error("Admin, Manager or HR access is required");
    const { fromEmployee } = await import("@/lib/db");
    const path = `employees?id=eq.${encodeURIComponent(data.id)}&select=*`;
    const response = await sbRest(auth.ctx, path);
    if (!response.ok) throw new Error("Could not read the worker; no changes saved");
    const rows = await response.json();
    if (!Array.isArray(rows) || rows.length !== 1) throw new Error("Worker not found or access denied");
    const existing = fromEmployee(rows[0]);
    permitSchema.parse({ workPermitIssueDate: existing.workPermitIssueDate, workPermitExpiryDate: existing.workPermitExpiryDate, ...data.patch });
    if (hasOnboarding(existing)) {
      const tracking = readOnboarding(existing);
      if (!tracking) throw new Error("Review the worker's onboarding details before updating permits");
      onboardingEmployeePatch({ ...existing, ...data.patch }, tracking);
    }
    const columns: Record<string, string> = { workPermitNumber: "work_permit_number", workPermitIssueDate: "work_permit_issue_date", workPermitExpiryDate: "work_permit_expiry_date", passportNumber: "passport_number", passportExpiry: "passport_expiry", medicalInsuranceExpiry: "medical_insurance_expiry", medicalCheckupDue: "medical_checkup_due", safetyCourseNo: "safety_course_no", safetyCourseExpiry: "safety_course_expiry" };
    const payload = Object.fromEntries(Object.entries(data.patch).map(([key, value]) => [columns[key], value || null]));
    if (!Object.keys(payload).length) throw new Error("No details supplied");
    if (data.patch.workPermitExpiryDate) payload.pass_expiry = data.patch.workPermitExpiryDate;
    const saved = await sbRest(auth.ctx, path, { method: "PATCH", body: JSON.stringify(payload), prefer: "return=representation" });
    if (!saved.ok) throw new Error("Permit update failed; refresh and retry");
    const verified = await sbRest(auth.ctx, path);
    if (!verified.ok) throw new Error("Update could not be verified; refresh before retrying");
    const confirmed = await verified.json();
    if (!Array.isArray(confirmed) || confirmed.length !== 1 || Object.entries(payload).some(([key, value]) => (confirmed[0][key] ?? null) !== value)) throw new Error("Saved permit details could not be confirmed; refresh before retrying");
    return { saved: true };
  });