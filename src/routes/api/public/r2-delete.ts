import { createFileRoute } from "@tanstack/react-router";
import { r2Client, safeKey, verifyUser } from "@/lib/r2.server";

export const Route = createFileRoute("/api/public/r2-delete")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const userId = await verifyUser(request);
        if (!userId) return new Response("Unauthorized", { status: 401 });
        const body = (await request.json().catch(() => ({}))) as { key?: string };
        const key = safeKey(body.key || "");
        if (!key) return new Response("Missing key", { status: 400 });
        try {
          const { client, base } = r2Client();
          const res = await client.fetch(`${base}/${key}`, { method: "DELETE" });
          if (!res.ok && res.status !== 404) {
            return new Response(`Delete failed (${res.status})`, { status: 502 });
          }
        } catch (err) {
          return new Response(err instanceof Error ? err.message : "Error", { status: 500 });
        }
        return Response.json({ ok: true });
      },
    },
  },
});