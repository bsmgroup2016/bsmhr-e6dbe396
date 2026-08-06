import { createFileRoute } from "@tanstack/react-router";
import {
  TASK_FLOW,
  mapDriverTaskRow,
  type TaskStatus,
} from "@/lib/driver-tasks-core";
import {
  fail,
  hasAnyRole,
  ok,
  preflight,
  readJson,
  requireAuth,
  sbRest,
  sbSelect,
} from "@/lib/api-v1.server";

type Body = {
  status?: TaskStatus;
  note?: string;
  lat?: number;
  lng?: number;
  speedKmh?: number;
};

const VALID: string[] = [...TASK_FLOW, "Cancelled"];

/** Single task read + driver status progression from the mobile app. */
export const Route = createFileRoute("/api/public/v1/driver/tasks/$id")({
  server: {
    handlers: {
      OPTIONS: preflight,
      GET: async ({ request, params }) => {
        const auth = await requireAuth(request);
        if ("response" in auth) return auth.response;
        const { ctx } = auth;
        const rows = await sbSelect<Record<string, unknown>>(
          ctx,
          `driver_tasks?select=*&id=eq.${encodeURIComponent(params.id)}&limit=1`,
        );
        const row = rows[0];
        if (!row) return fail(404, "not_found", "Task not found");
        const isStaff = hasAnyRole(ctx, ["admin", "hr", "manager", "supervisor"]);
        if (!isStaff && row['driver_employee_id'] !== ctx.employeeId)
          return fail(403, "forbidden", "This task is not assigned to you");
        return ok(mapDriverTaskRow(row));
      },

      PATCH: async ({ request, params }) => {
        const auth = await requireAuth(request);
        if ("response" in auth) return auth.response;
        const { ctx } = auth;
        const body = await readJson<Body>(request);
        if (!body) return fail(400, "bad_request", "JSON body required");
        if (body.status && !VALID.includes(body.status))
          return fail(400, "bad_request", "Unknown task status");

        const rows = await sbSelect<Record<string, unknown>>(
          ctx,
          `driver_tasks?select=id,driver_employee_id,status&id=eq.${encodeURIComponent(params.id)}&limit=1`,
        );
        const row = rows[0];
        if (!row) return fail(404, "not_found", "Task not found");
        const isStaff = hasAnyRole(ctx, ["admin", "hr", "manager", "supervisor"]);
        if (!isStaff && row['driver_employee_id'] !== ctx.employeeId)
          return fail(403, "forbidden", "This task is not assigned to you");

        const now = new Date().toISOString();
        const patch: Record<string, unknown> = { updated_at: now };
        if (body.status) {
          patch['status'] = body.status;
          patch['status_updated_at'] = now;
        }
        if (body.note !== undefined) patch['driver_note'] = body.note;
        if (typeof body.lat === "number" && typeof body.lng === "number") {
          patch['last_lat'] = body.lat;
          patch['last_lng'] = body.lng;
          patch['last_location_at'] = now;
        }

        const res = await sbRest(ctx, `driver_tasks?id=eq.${encodeURIComponent(params.id)}`, {
          method: "PATCH",
          prefer: "return=representation",
          body: JSON.stringify(patch),
        });
        if (!res.ok) return fail(502, "upstream_error", "Unable to update task");
        const saved = (await res.json()) as Record<string, unknown>[];

        // Keep a breadcrumb whenever the app reports a position with the update.
        if (typeof body.lat === "number" && typeof body.lng === "number") {
          await sbRest(ctx, `driver_task_pings`, {
            method: "POST",
            body: JSON.stringify({
              task_id: params.id,
              driver_employee_id: row['driver_employee_id'],
              lat: body.lat,
              lng: body.lng,
              status: body.status ?? row['status'],
              speed_kmh: body.speedKmh ?? null,
              recorded_at: now,
            }),
          });
        }

        return ok(saved[0] ? mapDriverTaskRow(saved[0]) : null);
      },
    },
  },
});
