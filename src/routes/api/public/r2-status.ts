import { createFileRoute } from "@tanstack/react-router";
import { r2Client } from "@/lib/r2.server";

export const Route = createFileRoute("/api/public/r2-status")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const { client, base } = r2Client();
          const res = await client.fetch(`${base}?list-type=2&max-keys=1`);
          return Response.json({
            configured: true,
            reachable: res.ok,
            status: res.status,
          });
        } catch (err) {
          return Response.json({
            configured: false,
            reachable: false,
            message: err instanceof Error ? err.message : "R2 not configured",
          });
        }
      },
    },
  },
});