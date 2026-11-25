import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { verifyUser } from "@/lib/r2.server";
import {
  rest,
  isAdmin,
  listIntegrations,
  clearIntegrationCache,
  effectiveKey,
  toProvider,
  pingProvider,
  type IntegrationRow,
} from "@/lib/api-integrations.server";

const fields = {
  label: z.string().trim().min(1).max(80),
  url: z.string().trim().url().max(300),
  model: z.string().trim().min(1).max(120),
  enabled: z.boolean(),
};

const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), category: z.enum(["ocr", "chatbot", "excel_ai"]), ...fields, apiKey: z.string().trim().min(8).max(400) }),
  z.object({
    action: z.literal("update"),
    id: z.string().uuid(),
    label: fields.label.optional(),
    url: fields.url.optional(),
    model: fields.model.optional(),
    enabled: z.boolean().optional(),
    apiKey: z.string().trim().min(8).max(400).optional(),
    clearKey: z.boolean().optional(),
  }),
  z.object({ action: z.literal("delete"), id: z.string().uuid() }),
  z.object({ action: z.literal("move"), id: z.string().uuid(), direction: z.enum(["up", "down"]) }),
  z.object({ action: z.literal("test"), id: z.string().uuid() }),
]);

function safe(r: IntegrationRow) {
  return {
    id: r.id,
    category: r.category,
    label: r.label,
    url: r.url,
    model: r.model,
    priority: r.priority,
    enabled: r.enabled,
    updatedAt: r.updated_at,
    keySource: r.api_key ? "custom" : r.env_key && process.env[r.env_key] ? "secure" : "none",
  };
}

async function guard(request: Request) {
  const uid = await verifyUser(request);
  if (!uid) return Response.json({ error: "Not signed in" }, { status: 401 });
  if (!(await isAdmin(uid))) return Response.json({ error: "Admins only" }, { status: 403 });
  return null;
}

export const Route = createFileRoute("/api/public/api-integrations")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const denied = await guard(request);
        if (denied) return denied;
        clearIntegrationCache();
        const rows = await listIntegrations();
        return Response.json({ items: rows.map(safe) }, { headers: { "Cache-Control": "no-store" } });
      },
      POST: async ({ request }) => {
        const denied = await guard(request);
        if (denied) return denied;
        const parsed = body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
        const d = parsed.data;
        try {
          clearIntegrationCache();
          const rows = await listIntegrations();
          if (d.action === "test") {
            const row = rows.find((r) => r.id === d.id);
            if (!row) return Response.json({ error: "Not found" }, { status: 404 });
            const p = toProvider(row);
            if (!p) return Response.json({ success: false, error: "No key added" });
            return Response.json(await pingProvider(p));
          }
          if (d.action === "create") {
            const max = Math.max(0, ...rows.filter((r) => r.category === d.category).map((r) => r.priority));
            await rest("api_integrations", {
              method: "POST",
              body: JSON.stringify({ category: d.category, label: d.label, url: d.url, model: d.model, enabled: d.enabled, api_key: d.apiKey, priority: max + 1 }),
            });
          } else if (d.action === "update") {
            const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
            for (const k of ["label", "url", "model", "enabled"] as const) if (d[k] !== undefined) patch[k] = d[k];
            if (d.apiKey) patch.api_key = d.apiKey;
            if (d.clearKey) patch.api_key = null;
            await rest(`api_integrations?id=eq.${d.id}`, { method: "PATCH", body: JSON.stringify(patch) });
          } else if (d.action === "delete") {
            await rest(`api_integrations?id=eq.${d.id}`, { method: "DELETE" });
          } else if (d.action === "move") {
            const row = rows.find((r) => r.id === d.id);
            if (!row) return Response.json({ error: "Not found" }, { status: 404 });
            const group = rows.filter((r) => r.category === row.category).sort((a, b) => a.priority - b.priority);
            const i = group.findIndex((r) => r.id === row.id);
            const j = d.direction === "up" ? i - 1 : i + 1;
            if (j >= 0 && j < group.length) {
              [group[i], group[j]] = [group[j], group[i]];
              await Promise.all(
                group.map((r, idx) => rest(`api_integrations?id=eq.${r.id}`, { method: "PATCH", body: JSON.stringify({ priority: idx + 1 }) })),
              );
            }
          }
          clearIntegrationCache();
          return Response.json({ ok: true });
        } catch (e) {
          console.error("api-integrations failed:", e);
          return Response.json({ error: "Could not save — please try again" }, { status: 500 });
        }
      },
    },
  },
});

// keep effectiveKey referenced for tree-shaking clarity
void effectiveKey;
