import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { onboardingSchema, onboardingEmployeePatch } from "@/core/onboarding";

const sessionMiddleware = createMiddleware({ type: "function" }).client(async ({ next }) => {
  const { supabase } = await import("@/integrations/supabase/client");
  const { data } = await supabase.auth.getSession();
  return next({ headers: { Authorization: `Bearer ${data.session?.access_token ?? ""}` } });
});
export const validateOnboardingSave = createServerFn({ method: "POST" })
  .middleware([sessionMiddleware])
  .inputValidator((input: unknown) => z.object({
    tracking: onboardingSchema,
    permit: z.object({ workPermitNumber: z.string().max(100).optional(), workPermitIssueDate: z.string().max(10).optional(), workPermitExpiryDate: z.string().max(10).optional() }),
  }).parse(input))
  .handler(async ({ data }) => {
    const { requireAuth, requireRole } = await import("@/lib/api-v1.server");
    const auth = await requireAuth(getRequest());
    if ("response" in auth) throw new Error("Sign in before saving onboarding data");
    if (requireRole(auth.ctx, ["admin", "manager", "hr"])) throw new Error("Onboarding requires Admin, Manager or HR access");
    onboardingEmployeePatch(data.permit, data.tracking);
    return { valid: true };
  });