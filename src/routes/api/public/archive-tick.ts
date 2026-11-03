import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "node:crypto";
export const Route = createFileRoute("/api/public/archive-tick")({ server: { handlers: {
  POST: async ({ request }) => {
    const expected = process.env.CRON_SECRET; const received = request.headers.get("x-cron-secret") ?? "";
    if (!expected || Buffer.byteLength(received) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(received), Buffer.from(expected))) return new Response("Unauthorized", { status: 401, headers: { "Cache-Control": "no-store" } });
    const a = await import("@/lib/archive.server");
    try { const result = await a.archiveCron(); return Response.json({ ok: true, idle: "idle" in result }, { headers: { "Cache-Control": "no-store" } }); }
    catch { return Response.json({ ok: false, error: "Archive step failed; review admin settings." }, { status: 500, headers: { "Cache-Control": "no-store" } }); }
  },
} } });