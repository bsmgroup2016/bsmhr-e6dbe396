import { createFileRoute } from "@tanstack/react-router";
import { mapDriverTaskRow } from "@/lib/driver-tasks-core";
import {
  fail,
  hasAnyRole,
  listParams,
  ok,
  preflight,
  requireAuth,
  sbRest,
} from "@/lib/api-v1.server";

/**
 * Driver task list.
 * Drivers see only their own tasks; staff may pass ?driverId= to see one driver.
 * ?open=1 returns only tasks that are still in progress (the app's home screen).
 */
export const Route = createFileRoute("/api/public/v1/driver/tasks")({
  server: {
    handlers: {
      OPTIONS: preflight,
      GET: async ({ request }) => {
        const auth = await requireAuth(request);
        if ("response" in auth) return auth.response;
        const { ctx } = auth;
        const p = listParams(request);

        const isStaff = hasAnyRole(ctx, ["admin", "hr", "manager", "supervisor"]);
        const scoped = isStaff
          ? (p.url.searchParams.get("driverId") ?? "")
          : (ctx.employeeId ?? "");
        if (!isStaff && !scoped) return fail(403, "forbidden", "No driver profile linked");

        const filters = [
          `select=*`,
          `order=scheduled_at.asc`,
          `limit=${p.limit}`,
          `offset=${p.offset}`,
        ];
        if (scoped) filters.push(`driver_employee_id=eq.${encodeURIComponent(scoped)}`);
        if (p.status) filters.push(`status=eq.${encodeURIComponent(p.status)}`);
        if (p.url.searchParams.get("open") === "1")
          filters.push(`status=not.in.("Back at office","Cancelled")`);
        if (p.from) filters.push(`scheduled_at=gte.${encodeURIComponent(p.from)}`);
        if (p.to) filters.push(`scheduled_at=lte.${encodeURIComponent(p.to)}`);

        const res = await sbRest(ctx, `driver_tasks?${filters.join("&")}`, {
          prefer: "count=exact",
        });
        if (!res.ok) return fail(502, "upstream_error", "Unable to load driver tasks");
        const rows = (await res.json()) as Record<string, unknown>[];
        const total = Number(res.headers.get("content-range")?.split("/")[1] ?? rows.length);
        return ok(rows.map(mapDriverTaskRow), {
          total,
          limit: p.limit,
          offset: p.offset,
          hasMore: p.offset + rows.length < total,
        });
      },
    },
  },
});
