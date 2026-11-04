import { createFileRoute } from "@tanstack/react-router";
import { canAccess } from "@/core/access";

export const Route = createFileRoute("/api/public/v1/claim-template")({
  server: { handlers: {
    GET: async ({ request }) => {
      const { requireAuth, sbRest, ok, fail } = await import("@/lib/api-v1.server");
      const auth = await requireAuth(request);
      if ("response" in auth) return auth.response;
      if (!canAccess("/time-cards", auth.ctx.roles)) return fail(403, "forbidden", "Claim sheet access required.");
      const response = await sbRest(auth.ctx, "storage_objects?select=key,original_name,created_at&folder=eq.claim-templates&order=created_at.desc,key.desc&limit=1");
      if (!response.ok) return fail(502, "template_unavailable", "Could not read the saved blank template.");
      const rows = await response.json();
      if (new URL(request.url).searchParams.get("download") === "1" && rows[0]) {
        const { r2FetchObject } = await import("@/lib/r2.server");
        const file = await r2FetchObject(rows[0].key);
        if (!file.ok) return fail(502, "template_unavailable", "Could not read the saved template file.");
        return new Response(file.body, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Cache-Control": "no-store" } });
      }
      return ok(rows[0] ?? null);
    },
  } },
});