import { createFileRoute } from "@tanstack/react-router";
import { fromEmployee } from "@/lib/db";
import {
  fail,
  listParams,
  ok,
  pgLike,
  preflight,
  requireAuth,
  requireRole,
  sbRest,
} from "@/lib/api-v1.server";

/** Paginated employee list — the mobile roster screen uses the same contract. */
export const Route = createFileRoute("/api/public/v1/employees")({
  server: {
    handlers: {
      OPTIONS: preflight,
      GET: async ({ request }) => {
        const auth = await requireAuth(request);
        if ("response" in auth) return auth.response;
        const { ctx } = auth;
        const denied = requireRole(ctx, ["admin", "hr", "manager", "supervisor"]);
        if (denied) return denied;

        const p = listParams(request);
        const filters = [`select=*`, `order=name.asc`, `limit=${p.limit}`, `offset=${p.offset}`];
        if (p.companyId) filters.push(`company_id=eq.${encodeURIComponent(p.companyId)}`);
        if (p.status) filters.push(`status=eq.${encodeURIComponent(p.status)}`);
        if (p.search)
          filters.push(
            `or=(name.ilike.${pgLike(p.search)},employee_code.ilike.${pgLike(p.search)},fin.ilike.${pgLike(p.search)})`,
          );

        const res = await sbRest(ctx, `employees?${filters.join("&")}`, {
          prefer: "count=exact",
        });
        if (!res.ok) return fail(502, "upstream_error", "Unable to load employees");

        const rows = (await res.json()) as Record<string, unknown>[];
        const total = Number(res.headers.get("content-range")?.split("/")[1] ?? rows.length);

        return ok(rows.map(fromEmployee), {
          total,
          limit: p.limit,
          offset: p.offset,
          hasMore: p.offset + rows.length < total,
        });
      },
    },
  },
});