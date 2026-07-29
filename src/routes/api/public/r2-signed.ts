import { createFileRoute } from "@tanstack/react-router";
import { keyFromRef, presignGet, verifyUser } from "@/lib/r2.server";

export const Route = createFileRoute("/api/public/r2-signed")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const userId = await verifyUser(request);
        if (!userId) return new Response("Unauthorized", { status: 401 });

        const key = keyFromRef(new URL(request.url).searchParams.get("key") || "");
        if (!key) return new Response("Missing key", { status: 400 });

        try {
          const url = await presignGet(key, 300);
          return Response.json({ url, expiresIn: 300 });
        } catch (err) {
          return new Response(err instanceof Error ? err.message : "Error", { status: 500 });
        }
      },
    },
  },
});