import { createFileRoute } from "@tanstack/react-router";
import { isAdmin, verifyUser } from "@/lib/r2.server";

/** Admin-only: which AI provider serves OCR/automation, and what the backup is. */
export const Route = createFileRoute("/api/public/ai-status")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const userId = await verifyUser(request);
        if (!userId) return new Response("Unauthorized", { status: 401 });
        if (!(await isAdmin(userId))) return new Response("Forbidden", { status: 403 });
        const { aiProviderStatus } = await import("@/lib/ai.server");
        return Response.json(await aiProviderStatus());
      },
    },
  },
});
