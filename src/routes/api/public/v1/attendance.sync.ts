import { createFileRoute } from "@tanstack/react-router";
import { applyPunch, type PunchEvent } from "@/lib/attendance-punch.server";
import { fail, hasAnyRole, ok, preflight, readJson, requireAuth } from "@/lib/api-v1.server";

type Body = { events?: PunchEvent[] };

/**
 * Offline attendance queue flush.
 * The mobile app stores punches locally when there is no signal and POSTs the
 * whole queue here. Each event carries a `clientEventId`, so retrying the same
 * queue is safe — duplicates are reported, never double-saved.
 */
export const Route = createFileRoute("/api/public/v1/attendance/sync")({
  server: {
    handlers: {
      OPTIONS: preflight,
      POST: async ({ request }) => {
        const auth = await requireAuth(request);
        if ("response" in auth) return auth.response;
        const { ctx } = auth;
        const body = await readJson<Body>(request);
        const events = (body?.events ?? []).slice(0, 200);
        if (!events.length) return fail(400, "bad_request", "events array is required");

        const isStaff = hasAnyRole(ctx, ["admin", "hr", "manager", "supervisor"]);
        const results = [];
        for (const event of events) {
          const employeeId = isStaff ? (event.employeeId ?? ctx.employeeId) : ctx.employeeId;
          if (!employeeId) {
            results.push({
              clientEventId: event.clientEventId ?? null,
              status: "error" as const,
              message: "No worker profile linked",
            });
            continue;
          }
          results.push(await applyPunch(ctx, event, employeeId, "mobile-offline"));
        }

        return ok({
          saved: results.filter((r) => r.status === "saved").length,
          duplicates: results.filter((r) => r.status === "duplicate").length,
          rejected: results.filter((r) => r.status === "rejected").length,
          flagged: results.filter((r) => r.verdict?.verification === "flagged").length,
          failed: results.filter((r) => r.status === "error").length,
          results,
        });
      },
    },
  },
});
