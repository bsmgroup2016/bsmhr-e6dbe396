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
      return ok(rows[0] ?? null);
    },
  } },
});