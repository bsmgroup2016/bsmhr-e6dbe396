import { createFileRoute } from "@tanstack/react-router";
import { isAdmin, r2Client, verifyUser } from "@/lib/r2.server";

export const Route = createFileRoute("/api/public/r2-status")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const userId = await verifyUser(request);
        if (!userId) return new Response("Unauthorized", { status: 401 });
        if (!(await isAdmin(userId))) return new Response("Forbidden", { status: 403 });
        try {
          const { client, base } = r2Client();
          const res = await client.fetch(`${base}?list-type=2&max-keys=1`);
          return Response.json({
            configured: true,
            reachable: res.ok,
            status: res.status,
          });
        } catch {
          return Response.json({
            configured: false,
            reachable: false,
            message: "R2 not configured",
          });
        }
      },
    },
  },
});