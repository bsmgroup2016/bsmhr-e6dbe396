import { createFileRoute } from "@tanstack/react-router";

/**
 * Daily automation cron endpoint.
 * Call with header `x-cron-secret: <CRON_SECRET>`.
 * `?dry=1` computes without writing or emailing, `?payroll=1` forces the
 * month-end payroll draft outside the 1st–7th window.
 */
export const Route = createFileRoute("/api/public/run-automations")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.CRON_SECRET;
        if (!secret || request.headers.get("x-cron-secret") !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }
        const params = new URL(request.url).searchParams;
        try {
          const { runAutomations } = await import("@/lib/automation-run.server");
          return Response.json(
            await runAutomations({
              dryRun: params.get("dry") === "1",
              forcePayroll: params.get("payroll") === "1",
            }),
          );
        } catch (e) {
          console.error("run-automations failed", e);
          return new Response(e instanceof Error ? e.message : "Failed", { status: 500 });
        }
      },
    },
  },
});
