import { createFileRoute } from "@tanstack/react-router";
import { fromAttendance } from "@/lib/db";
import { TABLE_COLUMNS } from "@/core/data-tables";
import { periodForMonth } from "@/core/data-pagination";
import { applyPunch, type PunchEvent } from "@/lib/attendance-punch.server";
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

type PunchBody = PunchEvent;

/**
 * Attendance read + punch. The Flutter app posts GPS punches to the same
 * endpoint the web QR punch screen uses.
 */
export const Route = createFileRoute("/api/public/v1/attendance")({
  server: {
    handlers: {
      OPTIONS: preflight,
      GET: async ({ request }) => {
        const auth = await requireAuth(request, "attendance");
        if ("response" in auth) return auth.response;
        const { ctx } = auth;
        const p = listParams(request);
        const isStaff = hasAnyRole(ctx, ["admin", "hr", "manager", "supervisor"]);

        const employeeId = p.url.searchParams.get("employeeId") ?? "";
        const scoped = isStaff ? employeeId : ctx.employeeId;
        if (!isStaff && !scoped) return fail(403, "forbidden", "No worker profile linked");

        const filters = [`select=${TABLE_COLUMNS.attendance}${p.companyId ? ",employees!inner(company_id)" : ""}`, `order=date.desc,id.desc`, `limit=${p.limit}`, `offset=${p.offset}`];
        if (p.companyId) filters.push(`employees.company_id=eq.${encodeURIComponent(p.companyId)}`);
        const month = p.url.searchParams.get("month");
        if (month) {
          try { const period = periodForMonth(month); filters.push(`date=gte.${period.from}`, `date=lte.${period.to}`); }
          catch { return fail(400, "invalid_period", "Month must be YYYY-MM"); }
        }
        if (scoped) filters.push(`employee_id=eq.${encodeURIComponent(scoped)}`);
        if (p.from) filters.push(`date=gte.${encodeURIComponent(p.from)}`);
        if (p.to) filters.push(`date=lte.${encodeURIComponent(p.to)}`);

        const res = await sbRest(ctx, `attendance?${filters.join("&")}`, { prefer: "count=exact" });
        if (!res.ok) return fail(502, "upstream_error", "Unable to load attendance");
        const rows = (await res.json()) as Record<string, unknown>[];
        const total = Number(res.headers.get("content-range")?.split("/")[1] ?? rows.length);
        return ok(rows.map(fromAttendance), { total, limit: p.limit, offset: p.offset });
      },

      POST: async ({ request }) => {
        const auth = await requireAuth(request, "attendance");
        if ("response" in auth) return auth.response;
        const { ctx } = auth;

        const body = await readJson<PunchBody>(request);
        if (!body) return fail(400, "bad_request", "JSON body required");

        const isStaff = hasAnyRole(ctx, ["admin", "hr", "manager", "supervisor"]);
        const employeeId = isStaff ? (body.employeeId ?? ctx.employeeId) : ctx.employeeId;
        if (!employeeId) return fail(400, "bad_request", "employeeId is required");

        // Same idempotent path as the offline batch sync: a repeated
        // clientEventId is reported as a duplicate instead of saved twice.
        const outcome = await applyPunch(ctx, body, employeeId, "single");
        if (outcome.status === "rejected")
          return fail(422, "punch_rejected", outcome.message ?? "Punch rejected");
        if (outcome.status === "error")
          return fail(502, "upstream_error", outcome.message ?? "Unable to save attendance");
        return ok(outcome.attendance ?? null, {
          duplicate: outcome.status === "duplicate",
          verification: outcome.verdict?.verification ?? "unverified",
          geoStatus: outcome.verdict?.geoStatus ?? "unknown",
          distanceM: outcome.verdict?.distanceM ?? null,
          flags: outcome.verdict?.flags ?? [],
          notice: outcome.verdict?.message ?? null,
        });
      },
    },
  },
});
