import { createFileRoute } from "@tanstack/react-router";
import { r2Client, safeKey } from "@/lib/r2.server";

export const Route = createFileRoute("/api/public/r2-file")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const key = safeKey(new URL(request.url).searchParams.get("key") || "");
        if (!key) return new Response("Missing key", { status: 400 });
        try {
          const { client, base } = r2Client();
          const res = await client.fetch(`${base}/${key}`);
          if (!res.ok) return new Response("Not found", { status: 404 });
          return new Response(res.body, {
            headers: {
              "Content-Type": res.headers.get("content-type") || "application/octet-stream",
              "Cache-Control": "private, max-age=300",
            },
          });
        } catch (err) {
          return new Response(err instanceof Error ? err.message : "Error", { status: 500 });
        }
      },
    },
  },
});