import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { requireAuth, requireRole, sbSelect } from "@/lib/api-v1.server";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("ensure"), employeeIds: z.array(z.string().uuid()).min(1).max(20) }),
  z.object({ action: z.literal("reset-password"), employeeId: z.string().uuid() }),
]);
const privateHeaders = { "Cache-Control": "no-store" };

export const Route = createFileRoute("/api/public/worker-accounts")({
  server: { handlers: { POST: async ({ request }) => {
    const auth = await requireAuth(request);
    if ("response" in auth) return auth.response;
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400, headers: privateHeaders });
    const body = parsed.data;
    const denied = requireRole(auth.ctx, body.action === "reset-password" ? ["admin"] : ["admin", "hr", "manager"]);
    if (denied) return denied;
    const ids = body.action === "ensure" ? [...new Set(body.employeeIds)] : [body.employeeId];
    const accessible = await sbSelect<{ id: string }>(auth.ctx, `employees?select=id&id=in.(${ids.join(",")})`);
    if (accessible.length !== ids.length) return Response.json({ error: "Worker access denied" }, { status: 403, headers: privateHeaders });
    const { ensureWorkerAccount, resetWorkerPassword } = await import("@/lib/worker-accounts.server");
    if (body.action === "reset-password") {
      try { return Response.json(await resetWorkerPassword(body.employeeId), { headers: privateHeaders }); }
      catch { return Response.json({ error: "Could not set worker password" }, { status: 502, headers: privateHeaders }); }
    }
    const results = [];
    for (const id of ids) {
      try { results.push({ ...await ensureWorkerAccount(id), ok: true }); }
      catch { results.push({ employeeId: id, ok: false, error: "Account not created. Retry this worker." }); }
    }
    return Response.json({ results }, { headers: privateHeaders });
  } } },
});