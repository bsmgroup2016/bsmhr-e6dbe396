import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { verifyUser, isAdmin } from "@/lib/r2.server";

const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("cron") }),
  z.object({ action: z.literal("crawl"), skills: z.boolean().default(true) }),
  z.object({ action: z.literal("generate_skills") }),
  z.object({ action: z.literal("settings"), crawls_per_day: z.number().int().min(0).max(24), auto_skills: z.boolean() }),
  z.object({ action: z.literal("add"), kind: z.enum(["note", "skill"]), title: z.string().trim().min(1).max(120), content: z.string().trim().min(1).max(4000) }),
  z.object({
    action: z.literal("update"),
    id: z.string().uuid(),
    title: z.string().trim().min(1).max(120).optional(),
    content: z.string().trim().min(1).max(4000).optional(),
    enabled: z.boolean().optional(),
  }),
  z.object({ action: z.literal("delete"), id: z.string().uuid() }),
]);

async function adminOnly(request: Request) {
  const userId = await verifyUser(request);
  if (!userId) return new Response("Unauthorized", { status: 401 });
  if (!(await isAdmin(userId))) return new Response("Forbidden", { status: 403 });
  return null;
}

/** Admin-only chatbot training API. `action: cron` is accepted only with x-cron-secret. */
export const Route = createFileRoute("/api/public/ai-training")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const denied = await adminOnly(request);
        if (denied) return denied;
        const t = await import("@/lib/ai-training.server");
        const { activeProviders } = await import("@/lib/api-integrations.server");
        const [settings, knowledge, runs, providers] = await Promise.all([t.getSettings(), t.listKnowledge(), t.listRuns(), activeProviders("chatbot")]);
        return Response.json({
          settings,
          knowledge,
          runs,
          providers: providers.map((p) => ({ name: p.name, model: p.model, host: new URL(p.url).host })),
        });
      },
      POST: async ({ request }) => {
        let p;
        try { p = body.parse(await request.json()); } catch { return Response.json({ error: "Invalid request" }, { status: 400 }); }
        const t = await import("@/lib/ai-training.server");
        if (p.action === "cron") {
          const secret = process.env.CRON_SECRET;
          if (!secret || request.headers.get("x-cron-secret") !== secret) return new Response("Unauthorized", { status: 401 });
          try { return Response.json(await t.cronTick()); } catch (e) { return Response.json({ error: String(e) }, { status: 500 }); }
        }
        const denied = await adminOnly(request);
        if (denied) return denied;
        try {
          switch (p.action) {
            case "crawl": return Response.json(await t.runCrawl("manual", p.skills));
            case "generate_skills": return Response.json(await t.generateSkills());
            case "settings": await t.saveSettings({ crawls_per_day: p.crawls_per_day, auto_skills: p.auto_skills }); break;
            case "add": await t.addKnowledge({ kind: p.kind, title: p.title, content: p.content }); break;
            case "update": await t.updateKnowledge(p.id, { title: p.title, content: p.content, enabled: p.enabled }); break;
            case "delete": await t.deleteKnowledge(p.id); break;
          }
          return Response.json({ ok: true });
        } catch (e) {
          return Response.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
        }
      },
    },
  },
});
