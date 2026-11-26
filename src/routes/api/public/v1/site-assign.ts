import { createFileRoute } from "@tanstack/react-router";
import { fail, ok, preflight, readJson, requireAuth } from "@/lib/api-v1.server";
import { confirmChosenSite } from "@/lib/site-auto-assign.server";
import { singaporeDate } from "@/core/portal-punch";

/** Worker confirms which of several nearby sites they are working at today. */
export const Route = createFileRoute("/api/public/v1/site-assign")({
  server: {
    handlers: {
      OPTIONS: preflight,
      POST: async ({ request }) => {
        const auth = await requireAuth(request, "attendance");
        if ("response" in auth) return auth.response;
        const employeeId = auth.ctx.employeeId;
        if (!employeeId) return fail(403, "forbidden", "No worker profile linked");
        const body = await readJson<{ siteId?: string }>(request);
        const siteId = body?.siteId?.trim();
        if (!siteId || !/^[0-9a-f-]{36}$/i.test(siteId)) return fail(400, "bad_request", "siteId is required");
        const result = await confirmChosenSite(employeeId, singaporeDate(new Date()), siteId);
        if (result.status !== "assigned") return fail(422, "not_assigned", "reason" in result ? result.reason : "Not assigned");
        return ok(result);
      },
    },
  },
});
