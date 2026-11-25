import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { verifyUser, userRoles } from "@/lib/r2.server";
import { activeProviders, postChat } from "@/lib/api-integrations.server";
import { EXCEL_AI_SYSTEM_PROMPT, parseExcelAiReply } from "@/core/excel-ai-plan";

const STAFF = ["admin", "hr", "manager", "accounts"];
const body = z.object({ month: z.string().regex(/^\d{4}-\d{2}$/), records: z.array(z.record(z.string(), z.union([z.string(), z.number(), z.null()]))).max(3000) });

/** Staff-only: asks the enabled Excel AI provider (e.g. Claude) for a formula plan. Never returns keys. */
export const Route = createFileRoute("/api/public/excel-ai")({
  server: { handlers: {
    POST: async ({ request }) => {
      const uid = await verifyUser(request);
      if (!uid) return Response.json({ error: "Not signed in" }, { status: 401 });
      if (!(await userRoles(uid)).some((r) => STAFF.includes(r))) return Response.json({ error: "Not allowed" }, { status: 403 });
      const parsed = body.safeParse(await request.json().catch(() => null));
      if (!parsed.success) return Response.json({ error: "Invalid input" }, { status: 400 });
      const providers = await activeProviders("excel_ai");
      if (!providers.length) return Response.json({ plan: null, error: "No Excel AI provider is enabled in Settings" });
      for (const p of providers) {
        try {
          const res = await postChat(p, {
            max_tokens: 4096, temperature: 0.1,
            messages: [{ role: "system", content: EXCEL_AI_SYSTEM_PROMPT }, { role: "user", content: `Month ${parsed.data.month}. Records:\n${JSON.stringify(parsed.data.records).slice(0, 180_000)}` }],
          }, { signal: AbortSignal.timeout(90_000) });
          if (!res.ok) { console.error("excel-ai provider failed", p.name, res.status); continue; }
          const json = await res.json() as { choices?: { message?: { content?: string } }[] };
          const content = json.choices?.[0]?.message?.content ?? "";
          if (!content.trim()) continue;
          return Response.json({ plan: parseExcelAiReply(content), provider: p.name, model: p.model });
        } catch (e) { console.error("excel-ai provider error", p.name, e); }
      }
      return Response.json({ plan: null, error: "Excel AI did not answer" });
    },
  } },
});
