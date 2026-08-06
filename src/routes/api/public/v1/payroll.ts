import { createFileRoute } from "@tanstack/react-router";
import { fromPayroll } from "@/lib/db";
import {
  fail,
  hasAnyRole,
  listParams,
  ok,
  preflight,
  requireAuth,
  sbRest,
} from "@/lib/api-v1.server";

/** Payslip history. Workers see only their own entries. */
export const Route = createFileRoute("/api/public/v1/payroll")({
  server: {
    handlers: {
      OPTIONS: preflight,
      GET: async ({ request }) => {
        const auth = await requireAuth(request);
        if ("response" in auth) return auth.response;
        const { ctx } = auth;
        const p = listParams(request);
        const isStaff = hasAnyRole(ctx, ["admin", "hr", "manager"]);
        const scoped = isStaff ? (p.url.searchParams.get("employeeId") ?? "") : ctx.employeeId;
        if (!isStaff && !scoped) return fail(403, "forbidden", "No worker profile linked");

        const month = p.url.searchParams.get("month") ?? "";
        const filters = [`select=*`, `order=month.desc`, `limit=${p.limit}`, `offset=${p.offset}`];
        if (scoped) filters.push(`employee_id=eq.${encodeURIComponent(scoped)}`);
        if (month) filters.push(`month=eq.${encodeURIComponent(month)}`);

        const res = await sbRest(ctx, `payroll?${filters.join("&")}`, { prefer: "count=exact" });
        if (!res.ok) return fail(502, "upstream_error", "Unable to load payroll");
        const rows = (await res.json()) as Record<string, unknown>[];
        const total = Number(res.headers.get("content-range")?.split("/")[1] ?? rows.length);
        return ok(rows.map(fromPayroll), { total, limit: p.limit, offset: p.offset });
      },
    },
  },
});