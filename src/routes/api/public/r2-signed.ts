import { createFileRoute } from "@tanstack/react-router";
import { canAccessKey, keyFromRef, presignGet, verifyUser } from "@/lib/r2.server";

export const Route = createFileRoute("/api/public/r2-signed")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const userId = await verifyUser(request);
        if (!userId) return new Response("Unauthorized", { status: 401 });

        const key = keyFromRef(new URL(request.url).searchParams.get("key") || "");
        if (!key) return new Response("Missing key", { status: 400 });
        if (!(await canAccessKey(userId, key)))
          return new Response("Not found", { status: 404 });

        try {
          const url = await presignGet(key, 300);
          return Response.json({ url, expiresIn: 300 });
        } catch {
          return new Response("Unable to create link", { status: 500 });
        }
      },
    },
  },
});