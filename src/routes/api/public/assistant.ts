import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { verifyUser } from "@/lib/r2.server";

const ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRocmZ5ZXlxYWZtZG5wZXhnbWxjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyNTMzNTcsImV4cCI6MjEwMDgyOTM1N30.4EGhaZVMSZYI2NPo6mdzBLgKbZJjlVqJ-cdm7VqDvrQ";

const body = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(8000) }))
    .min(1)
    .max(40),
});

/** Signed-in users only; data lookups run with the caller's own session. */
export const Route = createFileRoute("/api/public/assistant")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await verifyUser(request))) return new Response("Unauthorized", { status: 401 });
        const { assistantStatus } = await import("@/lib/assistant.server");
        return Response.json({ providers: assistantStatus() });
      },
      POST: async ({ request }) => {
        if (!(await verifyUser(request))) return new Response("Unauthorized", { status: 401 });
        let parsed;
        try {
          parsed = body.parse(await request.json());
        } catch {
          return Response.json({ error: "Invalid request" }, { status: 400 });
        }
        try {
          const { runAssistant } = await import("@/lib/assistant.server");
          const out = await runAssistant(parsed.messages, request.headers.get("authorization")!, ANON);
          return Response.json(out);
        } catch (e) {
          return Response.json({ error: e instanceof Error ? e.message : "Assistant failed" }, { status: 502 });
        }
      },
    },
  },
});
