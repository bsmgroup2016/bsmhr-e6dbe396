import { createFileRoute } from "@tanstack/react-router";
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

type Ping = { lat: number; lng: number; recordedAt?: string; speedKmh?: number; status?: string };
type Body = { taskId?: string; pings?: Ping[] } & Partial<Ping>;

/**
 * GPS breadcrumbs for one task.
 * POST accepts a single ping or a batch (`pings: [...]`), so the mobile app can
 * queue points while offline and flush them when the signal returns.
 */
export const Route = createFileRoute("/api/public/v1/driver/pings")({
  server: {
    handlers: {
      OPTIONS: preflight,
      GET: async ({ request }) => {
        const auth = await requireAuth(request);
        if ("response" in auth) return auth.response;
        const { ctx } = auth;
        const p = listParams(request);
        const taskId = p.url.searchParams.get("taskId") ?? "";
        if (!taskId) return fail(400, "bad_request", "taskId is required");

        const rows = await sbSelect<Record<string, unknown>>(
          ctx,
          `driver_task_pings?select=*&task_id=eq.${encodeURIComponent(taskId)}&order=recorded_at.asc&limit=${p.limit}`,
        );
        return ok(
          rows.map((r) => ({
            id: r['id'],
            taskId: r['task_id'],
            driverEmployeeId: r['driver_employee_id'],
            lat: Number(r['lat']),
            lng: Number(r['lng']),
            status: r['status'] ?? null,
            speedKmh: r['speed_kmh'] === null ? null : Number(r['speed_kmh']),
            recordedAt: r['recorded_at'],
          })),
        );
      },

      POST: async ({ request }) => {
        const auth = await requireAuth(request);
        if ("response" in auth) return auth.response;
        const { ctx } = auth;
        const body = await readJson<Body>(request);
        if (!body?.taskId) return fail(400, "bad_request", "taskId is required");

        const rows = await sbSelect<Record<string, unknown>>(
          ctx,
          `driver_tasks?select=id,driver_employee_id&id=eq.${encodeURIComponent(body.taskId)}&limit=1`,
        );
        const task = rows[0];
        if (!task) return fail(404, "not_found", "Task not found");
        const isStaff = hasAnyRole(ctx, ["admin", "hr", "manager", "supervisor"]);
        if (!isStaff && task['driver_employee_id'] !== ctx.employeeId)
          return fail(403, "forbidden", "This task is not assigned to you");

        const incoming: Ping[] =
          body.pings && body.pings.length
            ? body.pings
            : typeof body.lat === "number" && typeof body.lng === "number"
              ? [{ lat: body.lat, lng: body.lng, recordedAt: body.recordedAt, speedKmh: body.speedKmh, status: body.status }]
              : [];
        const clean = incoming
          .filter((p) => typeof p.lat === "number" && typeof p.lng === "number")
          .slice(0, 500);
        if (!clean.length) return fail(400, "bad_request", "At least one lat/lng point is required");

        const now = new Date().toISOString();
        const res = await sbRest(ctx, `driver_task_pings`, {
          method: "POST",
          body: JSON.stringify(
            clean.map((p) => ({
              task_id: body.taskId,
              driver_employee_id: task['driver_employee_id'],
              lat: p.lat,
              lng: p.lng,
              status: p.status ?? null,
              speed_kmh: p.speedKmh ?? null,
              recorded_at: p.recordedAt ?? now,
            })),
          ),
        });
        if (!res.ok) return fail(502, "upstream_error", "Unable to save location pings");

        const last = clean[clean.length - 1]!;
        await sbRest(ctx, `driver_tasks?id=eq.${encodeURIComponent(body.taskId)}`, {
          method: "PATCH",
          body: JSON.stringify({
            last_lat: last.lat,
            last_lng: last.lng,
            last_location_at: last.recordedAt ?? now,
            updated_at: now,
          }),
        });

        return ok({ saved: clean.length });
      },
    },
  },
});
