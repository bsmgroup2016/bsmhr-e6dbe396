import { createFileRoute } from "@tanstack/react-router";
import { verifyUser, userRoles } from "@/lib/r2.server";

const ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzk1ODUyMTUwLCJleHAiOjE5NTM1MzIxNTB9.oKHcsh1PF5fehDyqcQn7Ja9epYtV44TXHZdq-X28TLM";
/** Roles that get assistant popup alerts. */
const ALERT_ROLES = ["admin", "manager", "hr", "supervisor"];

/** Signed-in HR/staff only; insights are computed with the caller's own session. */
export const Route = createFileRoute("/api/public/ai-alerts")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const userId = await verifyUser(request);
        if (!userId) return new Response("Unauthorized", { status: 401 });
        const roles = await userRoles(userId);
        if (!roles.some((r) => ALERT_ROLES.includes(r))) return Response.json({ insights: [] });
        try {
          const { computeInsights } = await import("@/lib/insights.server");
          return Response.json(await computeInsights(request.headers.get("authorization")!, ANON), {
            headers: { "Cache-Control": "private, no-store" },
          });
        } catch (e) {
          return Response.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
        }
      },
    },
  },
});
