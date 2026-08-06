import { createFileRoute } from "@tanstack/react-router";
import { fromAttendance } from "@/lib/db";
import {
  fail,
  hasAnyRole,
  listParams,
  ok,
  preflight,
  readJson,
  requireAuth,
  sbRest,
  sbSelect,
} from "@/lib/api-v1.server";

type PunchBody = {
  employeeId?: string;
  date?: string;
  status?: string;
  checkIn?: string;
  checkOut?: string;
  siteId?: string;
  hoursWorked?: number;
  overtimeHours?: number;
  lat?: number;
  lng?: number;
  address?: string;
  notes?: string;
};

/**
 * Attendance read + punch. The Flutter app posts GPS punches to the same
 * endpoint the web QR punch screen uses.
 */
export const Route = createFileRoute("/api/public/v1/attendance")({
  server: {
    handlers: {
      OPTIONS: preflight,
      GET: async ({ request }) => {
        const auth = await requireAuth(request);
        if ("response" in auth) return auth.response;
        const { ctx } = auth;
        const p = listParams(request);
        const isStaff = hasAnyRole(ctx, ["admin", "hr", "manager", "supervisor"]);

        const employeeId = p.url.searchParams.get("employeeId") ?? "";
        const scoped = isStaff ? employeeId : ctx.employeeId;
        if (!isStaff && !scoped) return fail(403, "forbidden", "No worker profile linked");

        const filters = [`select=*`, `order=date.desc`, `limit=${p.limit}`, `offset=${p.offset}`];
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
        const auth = await requireAuth(request);
        if ("response" in auth) return auth.response;
        const { ctx } = auth;

        const body = await readJson<PunchBody>(request);
        if (!body) return fail(400, "bad_request", "JSON body required");

        const isStaff = hasAnyRole(ctx, ["admin", "hr", "manager", "supervisor"]);
        const employeeId = isStaff ? (body.employeeId ?? ctx.employeeId) : ctx.employeeId;
        if (!employeeId) return fail(400, "bad_request", "employeeId is required");

        const date = body.date ?? new Date().toISOString().slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
          return fail(400, "bad_request", "date must be YYYY-MM-DD");

        const existing = await sbSelect<{ id: string }>(
          ctx,
          `attendance?select=id&employee_id=eq.${encodeURIComponent(employeeId)}&date=eq.${date}&limit=1`,
        );

        const isCheckOut = Boolean(body.checkOut);
        const payload: Record<string, unknown> = {
          employee_id: employeeId,
          date,
          status: body.status ?? "Present",
          notes: body.notes ?? null,
        };
        if (body.siteId) payload["site_id"] = body.siteId;
        if (body.hoursWorked != null) payload["hours_worked"] = body.hoursWorked;
        if (body.overtimeHours != null) payload["overtime_hours"] = body.overtimeHours;
        if (isCheckOut) {
          payload["check_out"] = body.checkOut;
          if (body.lat != null) payload["check_out_lat"] = body.lat;
          if (body.lng != null) payload["check_out_lng"] = body.lng;
          if (body.address) payload["check_out_address"] = body.address;
        } else {
          payload["check_in"] = body.checkIn ?? new Date().toISOString().slice(11, 16);
          if (body.lat != null) payload["check_in_lat"] = body.lat;
          if (body.lng != null) payload["check_in_lng"] = body.lng;
          if (body.address) payload["check_in_address"] = body.address;
        }

        const row = existing[0];
        const res = row
          ? await sbRest(ctx, `attendance?id=eq.${row.id}`, {
              method: "PATCH",
              body: JSON.stringify(payload),
              prefer: "return=representation",
            })
          : await sbRest(ctx, `attendance`, {
              method: "POST",
              body: JSON.stringify(payload),
              prefer: "return=representation",
            });

        if (!res.ok) return fail(502, "upstream_error", "Unable to save attendance");
        const saved = (await res.json()) as Record<string, unknown>[];
        return ok(saved[0] ? fromAttendance(saved[0]) : null);
      },
    },
  },
});