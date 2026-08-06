import { createFileRoute } from "@tanstack/react-router";
import { fromProject } from "@/lib/db";
import {
  fail,
  listParams,
  ok,
  preflight,
  requireAuth,
  requireRole,
  sbRest,
} from "@/lib/api-v1.server";

export const Route = createFileRoute("/api/public/v1/projects")({
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

        const res = await sbRest(ctx, `projects?${filters.join("&")}`, { prefer: "count=exact" });
        if (!res.ok) return fail(502, "upstream_error", "Unable to load projects");
        const rows = (await res.json()) as Record<string, unknown>[];
        const total = Number(res.headers.get("content-range")?.split("/")[1] ?? rows.length);
        return ok(rows.map(fromProject), { total, limit: p.limit, offset: p.offset });
      },
    },
  },
});