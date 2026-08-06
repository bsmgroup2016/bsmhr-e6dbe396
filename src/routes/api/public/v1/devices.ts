import { createFileRoute } from "@tanstack/react-router";
import { fail, ok, preflight, readJson, requireAuth, sbRest, sbSelect } from "@/lib/api-v1.server";

type Body = {
  token?: string;
  platform?: "android" | "ios" | "web";
  appVersion?: string;
  deviceModel?: string;
};

/**
 * Device token registry for push notifications.
 * The Flutter app calls POST on every launch (upsert + last_seen) and DELETE on
 * logout so a shared phone never receives another worker's notifications.
 */
export const Route = createFileRoute("/api/public/v1/devices")({
  server: {
    handlers: {
      OPTIONS: preflight,
      GET: async ({ request }) => {
        const auth = await requireAuth(request);
        if ("response" in auth) return auth.response;
        const rows = await sbSelect<Record<string, unknown>>(
          auth.ctx,
          `device_tokens?select=id,platform,app_version,device_model,enabled,last_seen_at&order=last_seen_at.desc&limit=50`,
        );
        return ok(
          rows.map((r) => ({
            id: r["id"],
            platform: r["platform"],
            appVersion: r["app_version"] ?? null,
            deviceModel: r["device_model"] ?? null,
            enabled: r["enabled"],
            lastSeenAt: r["last_seen_at"],
          })),
        );
      },

      POST: async ({ request }) => {
        const auth = await requireAuth(request);
        if ("response" in auth) return auth.response;
        const { ctx } = auth;
        const body = await readJson<Body>(request);
        const token = (body?.token ?? "").trim();
        const platform = body?.platform ?? "android";
        if (!token) return fail(400, "bad_request", "token is required");
        if (!["android", "ios", "web"].includes(platform))
          return fail(400, "bad_request", "platform must be android, ios or web");

        const res = await sbRest(ctx, `device_tokens?on_conflict=token`, {
          method: "POST",
          prefer: "resolution=merge-duplicates,return=representation",
          body: JSON.stringify({
            user_id: ctx.userId,
            employee_id: ctx.employeeId,
            token,
            platform,
            app_version: body?.appVersion ?? null,
            device_model: body?.deviceModel ?? null,
            enabled: true,
            last_seen_at: new Date().toISOString(),
          }),
        });
        if (!res.ok) return fail(502, "upstream_error", "Unable to register device");
        const saved = (await res.json()) as Record<string, unknown>[];
        return ok({ id: saved[0]?.["id"] ?? null, registered: true });
      },

      DELETE: async ({ request }) => {
        const auth = await requireAuth(request);
        if ("response" in auth) return auth.response;
        const url = new URL(request.url);
        const body = await readJson<Body>(request);
        const token = (body?.token ?? url.searchParams.get("token") ?? "").trim();
        if (!token) return fail(400, "bad_request", "token is required");
        const res = await sbRest(
          auth.ctx,
          `device_tokens?token=eq.${encodeURIComponent(token)}&user_id=eq.${auth.ctx.userId}`,
          { method: "DELETE", prefer: "return=minimal" },
        );
        if (!res.ok) return fail(502, "upstream_error", "Unable to remove device");
        return ok({ removed: true });
      },
    },
  },
});
