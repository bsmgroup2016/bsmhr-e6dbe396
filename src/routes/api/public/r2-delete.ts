import { createFileRoute } from "@tanstack/react-router";
import { isAdmin, r2ReadClients, safeKey, unregisterObject, verifyUser } from "@/lib/r2.server";

export const Route = createFileRoute("/api/public/r2-delete")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const userId = await verifyUser(request);
        if (!userId) return new Response("Unauthorized", { status: 401 });
        if (!(await isAdmin(userId))) return new Response("Forbidden", { status: 403 });
        const body = (await request.json().catch(() => ({}))) as { key?: string };
        const key = safeKey(body.key || "");
        if (!key) return new Response("Missing key", { status: 400 });
        try {
          for (const { client, base } of r2ReadClients(key)) {
            const res = await client.fetch(`${base}/${key}`, { method: "DELETE" });
            if (!res.ok && res.status !== 404) {
              return new Response(`Delete failed (${res.status})`, { status: 502 });
            }
          }
          await unregisterObject(key);
        } catch {
          return new Response("Delete failed", { status: 500 });
        }
        return Response.json({ ok: true });
      },
    },
  },
});