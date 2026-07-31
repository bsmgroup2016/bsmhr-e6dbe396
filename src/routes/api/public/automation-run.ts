import { createFileRoute } from "@tanstack/react-router";
import { isAdmin, verifyUser } from "@/lib/r2.server";

/**
 * Admin-only manual trigger for the automation engine (Settings → Automation).
 * Body: { dryRun?: boolean; forcePayroll?: boolean }
 */
export const Route = createFileRoute("/api/public/automation-run")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const userId = await verifyUser(request);
        if (!userId) return new Response("Unauthorized", { status: 401 });
        if (!(await isAdmin(userId))) return new Response("Forbidden", { status: 403 });

        let body: { dryRun?: boolean; forcePayroll?: boolean } = {};
        try {
          body = (await request.json()) as typeof body;
        } catch {
          /* empty body = live run */
        }

        try {
          const { runAutomations } = await import("@/lib/automation-run.server");
          return Response.json(
            await runAutomations({
              dryRun: body.dryRun === true,
              forcePayroll: body.forcePayroll === true,
            }),
          );
        } catch (e) {
          console.error("automation-run failed", e);
          return new Response(e instanceof Error ? e.message : "Failed", { status: 500 });
        }
      },
    },
  },
});
