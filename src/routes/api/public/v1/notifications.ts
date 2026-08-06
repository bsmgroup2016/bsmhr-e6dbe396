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
} from "@/lib/api-v1.server";

type PatchBody = { ids?: string[]; all?: boolean };
type PostBody = { userIds?: string[]; employeeIds?: string[]; title?: string; body?: string; category?: string; data?: Record<string, string> };

/** In-app notification inbox (RLS scopes every read to the caller). */
export const Route = createFileRoute("/api/public/v1/notifications")({
  server: {
    handlers: {
      OPTIONS: preflight,
      GET: async ({ request }) => {
        const auth = await requireAuth(request);
        if ("response" in auth) return auth.response;
        const p = listParams(request);
        const filters = [`select=*`, `order=created_at.desc`, `limit=${p.limit}`, `offset=${p.offset}`];
        if (p.url.searchParams.get("unread") === "1") filters.push(`read_at=is.null`);
        const res = await sbRest(auth.ctx, `notifications?${filters.join("&")}`, {
          prefer: "count=exact",
        });
        if (!res.ok) return fail(502, "upstream_error", "Unable to load notifications");
        const rows = (await res.json()) as Record<string, unknown>[];
        const total = Number(res.headers.get("content-range")?.split("/")[1] ?? rows.length);
        return ok(
          rows.map((r) => ({
            id: r['id'],
            title: r['title'],
            body: r['body'],
            category: r['category'],
            data: r['data'] ?? {},
            readAt: r['read_at'] ?? null,
            createdAt: r['created_at'],
          })),
          { total, limit: p.limit, offset: p.offset, hasMore: p.offset + rows.length < total },
        );
      },

      /** Mark read: pass ids, or all: true. */
      PATCH: async ({ request }) => {
        const auth = await requireAuth(request);
        if ("response" in auth) return auth.response;
        const body = await readJson<PatchBody>(request);
        const now = new Date().toISOString();
        let path = `notifications?user_id=eq.${auth.ctx.userId}&read_at=is.null`;
        if (!body?.all) {
          const ids = (body?.ids ?? []).filter(Boolean).slice(0, 200);
          if (!ids.length) return fail(400, "bad_request", "ids or all is required");
          path += `&id=in.(${encodeURIComponent(ids.map((i) => `"${i}"`).join(","))})`;
        }
        const res = await sbRest(auth.ctx, path, {
          method: "PATCH",
          prefer: "return=minimal",
          body: JSON.stringify({ read_at: now }),
        });
        if (!res.ok) return fail(502, "upstream_error", "Unable to update notifications");
        return ok({ readAt: now });
      },

      /** Staff-only broadcast to selected users/employees. */
      POST: async ({ request }) => {
        const auth = await requireAuth(request);
        if ("response" in auth) return auth.response;
        if (!hasAnyRole(auth.ctx, ["admin", "hr", "manager", "supervisor"]))
          return fail(403, "forbidden", "Only staff can send notifications");
        const body = await readJson<PostBody>(request);
        const title = (body?.title ?? "").trim();
        const message = (body?.body ?? "").trim();
        if (!title || !message) return fail(400, "bad_request", "title and body are required");

        const { sendPush, userIdsForEmployees } = await import("@/lib/push.server");
        const fromEmployees = body?.employeeIds?.length
          ? await userIdsForEmployees(body.employeeIds.slice(0, 500))
          : [];
        const userIds = [...(body?.userIds ?? []), ...fromEmployees];
        if (!userIds.length) return fail(400, "bad_request", "No recipients resolved");

        const result = await sendPush({
          userIds,
          title,
          body: message,
          category: body?.category ?? "announcement",
          data: body?.data,
        });
        return ok(result);
      },
    },
  },
});
