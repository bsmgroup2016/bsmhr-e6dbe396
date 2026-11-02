import { createFileRoute } from "@tanstack/react-router";
import { canAccessKey, r2FetchObject, safeKey, verifyUser } from "@/lib/r2.server";

export const Route = createFileRoute("/api/public/r2-file")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const userId = await verifyUser(request);
        if (!userId) return new Response("Unauthorized", { status: 401 });
        const key = safeKey(new URL(request.url).searchParams.get("key") || "");
        if (!key) return new Response("Missing key", { status: 400 });
        if (!(await canAccessKey(userId, key)))
          return new Response("Not found", { status: 404 });
        try {
          const res = await r2FetchObject(key);
          if (!res.ok) return new Response("Not found", { status: 404 });
          return new Response(res.body, {
            headers: {
              "Content-Type": res.headers.get("content-type") || "application/octet-stream",
              "Cache-Control": "private, max-age=300",
            },
          });
        } catch {
          return new Response("Unable to fetch file", { status: 500 });
        }
      },
    },
  },
});