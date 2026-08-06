import { createFileRoute } from "@tanstack/react-router";
import { fromClient } from "@/lib/db";
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

export const Route = createFileRoute("/api/public/v1/clients")({
  server: {
    handlers: {
      OPTIONS: preflight,
      GET: async ({ request }) => {
        const auth = await requireAuth(request);
        if ("response" in auth) return auth.response;
        const { ctx } = auth;
        const denied = requireRole(ctx, ["admin", "hr", "manager"]);
        if (denied) return denied;

        const p = listParams(request);
        const filters = [`select=*`, `order=name.asc`, `limit=${p.limit}`, `offset=${p.offset}`];
        if (p.companyId) filters.push(`company_id=eq.${encodeURIComponent(p.companyId)}`);
        if (p.search) filters.push(`name=ilike.${pgLike(p.search)}`);

        const res = await sbRest(ctx, `clients?${filters.join("&")}`, { prefer: "count=exact" });
        if (!res.ok) return fail(502, "upstream_error", "Unable to load clients");
        const rows = (await res.json()) as Record<string, unknown>[];
        const total = Number(res.headers.get("content-range")?.split("/")[1] ?? rows.length);
        return ok(rows.map(fromClient), { total, limit: p.limit, offset: p.offset });
      },
    },
  },
});