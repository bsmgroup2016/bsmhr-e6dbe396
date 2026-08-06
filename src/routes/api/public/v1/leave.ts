import { createFileRoute } from "@tanstack/react-router";
import { fromLeave } from "@/lib/db";
import {
  fail,
  hasAnyRole,
  listParams,
  ok,
  preflight,
  readJson,
  requireAuth,
  sbRest,
} from "@/lib/api-v1.server";

type LeaveBody = {
  employeeId?: string;
  type?: string;
  startDate?: string;
  endDate?: string;
  days?: number;
  reason?: string;
};

/** Leave list + apply. Shared by the web portal and the mobile self-service app. */
export const Route = createFileRoute("/api/public/v1/leave")({
  server: {
    handlers: {
      OPTIONS: preflight,
      GET: async ({ request }) => {
        const auth = await requireAuth(request);
        if ("response" in auth) return auth.response;
        const { ctx } = auth;
        const p = listParams(request);
        const isStaff = hasAnyRole(ctx, ["admin", "hr", "manager", "supervisor"]);
        const scoped = isStaff ? (p.url.searchParams.get("employeeId") ?? "") : ctx.employeeId;
        if (!isStaff && !scoped) return fail(403, "forbidden", "No worker profile linked");

        const filters = [`select=*`, `order=start_date.desc`, `limit=${p.limit}`, `offset=${p.offset}`];
        if (scoped) filters.push(`employee_id=eq.${encodeURIComponent(scoped)}`);
        if (p.status) filters.push(`status=eq.${encodeURIComponent(p.status)}`);

        const res = await sbRest(ctx, `leave_requests?${filters.join("&")}`, { prefer: "count=exact" });
        if (!res.ok) return fail(502, "upstream_error", "Unable to load leave requests");
        const rows = (await res.json()) as Record<string, unknown>[];
        const total = Number(res.headers.get("content-range")?.split("/")[1] ?? rows.length);
        return ok(rows.map(fromLeave), { total, limit: p.limit, offset: p.offset });
      },

      POST: async ({ request }) => {
        const auth = await requireAuth(request);
        if ("response" in auth) return auth.response;
        const { ctx } = auth;
        const body = await readJson<LeaveBody>(request);
        if (!body) return fail(400, "bad_request", "JSON body required");

        const isStaff = hasAnyRole(ctx, ["admin", "hr", "manager"]);
        const employeeId = isStaff ? (body.employeeId ?? ctx.employeeId) : ctx.employeeId;
        if (!employeeId) return fail(400, "bad_request", "employeeId is required");
        if (!body.startDate || !body.endDate)
          return fail(400, "bad_request", "startDate and endDate are required");

        const res = await sbRest(ctx, `leave_requests`, {
          method: "POST",
          prefer: "return=representation",
          body: JSON.stringify({
            employee_id: employeeId,
            leave_type: body.type ?? "Annual Leave",
            start_date: body.startDate,
            end_date: body.endDate,
            days: body.days ?? 1,
            reason: body.reason ?? null,
            status: "Pending",
          }),
        });
        if (!res.ok) return fail(502, "upstream_error", "Unable to submit leave request");
        const saved = (await res.json()) as Record<string, unknown>[];
        return ok(saved[0] ? fromLeave(saved[0]) : null);
      },
    },
  },
});