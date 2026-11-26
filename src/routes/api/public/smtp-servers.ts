import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { verifyUser } from "@/lib/r2.server";
import { isAdmin, rest } from "@/lib/api-integrations.server";
import {
  listServers, loadGlobal, saveGlobal, sentToday, unavailableReason, sendWith, type SmtpServer,
} from "@/lib/smtp.server";

const base = {
  label: z.string().trim().min(1).max(80),
  host: z.string().trim().min(3).max(200),
  port: z.number().int().min(1).max(65535),
  secure: z.boolean(),
  username: z.string().trim().max(200).optional().nullable(),
  fromEmail: z.string().trim().email().max(200),
  fromName: z.string().trim().max(120).optional().nullable(),
  enabled: z.boolean(),
  dailyLimit: z.number().int().min(1).max(1_000_000).nullable(),
};

const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), ...base, password: z.string().max(500).optional() }),
  z.object({ action: z.literal("update"), id: z.string().uuid(), ...base, password: z.string().max(500).optional() }),
  z.object({ action: z.literal("toggle"), id: z.string().uuid(), enabled: z.boolean() }),
  z.object({ action: z.literal("delete"), id: z.string().uuid() }),
  z.object({ action: z.literal("move"), id: z.string().uuid(), direction: z.enum(["up", "down", "top"]) }),
  z.object({ action: z.literal("reset"), id: z.string().uuid() }),
  z.object({ action: z.literal("test"), id: z.string().uuid(), to: z.string().email() }),
  z.object({ action: z.literal("global"), primaryProvider: z.enum(["resend", "smtp"]).optional(), failoverEnabled: z.boolean().optional() }),
]);

function safe(s: SmtpServer) {
  return {
    id: s.id, label: s.label, host: s.host, port: s.port, secure: s.secure, username: s.username,
    fromEmail: s.from_email, fromName: s.from_name, priority: s.priority, enabled: s.enabled,
    dailyLimit: s.daily_limit, sentToday: sentToday(s), hasPassword: !!s.password,
    status: unavailableReason(s), cooldownUntil: s.cooldown_until, lastError: s.last_error,
    lastUsedAt: s.last_used_at, updatedAt: s.updated_at,
  };
}

async function guard(request: Request) {
  const uid = await verifyUser(request);
  if (!uid) return Response.json({ error: "Not signed in" }, { status: 401 });
  if (!(await isAdmin(uid))) return Response.json({ error: "Admins only" }, { status: 403 });
  return null;
}

const patchUrl = (id: string) => `smtp_servers?id=eq.${id}`;

export const Route = createFileRoute("/api/public/smtp-servers")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const denied = await guard(request);
        if (denied) return denied;
        const [servers, global] = await Promise.all([listServers(), loadGlobal()]);
        return Response.json(
          { servers: servers.map(safe), global, resendConfigured: !!process.env.RESEND_API_KEY },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
      POST: async ({ request }) => {
        const denied = await guard(request);
        if (denied) return denied;
        const parsed = body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
        const d = parsed.data;
        try {
          const servers = await listServers();
          const row = "id" in d ? servers.find((s) => s.id === d.id) : undefined;
          if ("id" in d && !row) return Response.json({ error: "Not found" }, { status: 404 });
          const now = new Date().toISOString();

          if (d.action === "create" || d.action === "update") {
            const rec: Record<string, unknown> = {
              label: d.label, host: d.host, port: d.port, secure: d.secure, username: d.username || null,
              from_email: d.fromEmail, from_name: d.fromName || null, enabled: d.enabled,
              daily_limit: d.dailyLimit, updated_at: now,
            };
            if (d.password) rec.password = d.password;
            if (d.action === "create") {
              rec.priority = Math.max(0, ...servers.map((s) => s.priority)) + 1;
              await rest("smtp_servers", { method: "POST", body: JSON.stringify(rec) });
            } else {
              await rest(patchUrl(d.id), { method: "PATCH", body: JSON.stringify(rec) });
            }
          } else if (d.action === "toggle") {
            await rest(patchUrl(d.id), { method: "PATCH", body: JSON.stringify({ enabled: d.enabled, updated_at: now }) });
          } else if (d.action === "delete") {
            await rest(patchUrl(d.id), { method: "DELETE" });
          } else if (d.action === "reset") {
            await rest(patchUrl(d.id), { method: "PATCH", body: JSON.stringify({ cooldown_until: null, last_error: null, sent_today: 0 }) });
          } else if (d.action === "move") {
            const list = [...servers];
            const i = list.findIndex((s) => s.id === d.id);
            const [item] = list.splice(i, 1);
            const j = d.direction === "top" ? 0 : d.direction === "up" ? Math.max(0, i - 1) : Math.min(list.length, i + 1);
            list.splice(j, 0, item!);
            await Promise.all(list.map((s, idx) => rest(patchUrl(s.id), { method: "PATCH", body: JSON.stringify({ priority: idx + 1 }) })));
          } else if (d.action === "global") {
            await saveGlobal(d);
          } else if (d.action === "test") {
            const { layout } = await import("@/lib/email.server");
            try {
              const subject = `SMTP test — ${row!.label}`;
              const sentAt = new Date().toISOString();
              await sendWith(row!, {
                to: d.to,
                subject,
                html: layout("SMTP test successful", `<p>The SMTP server <b>${row!.label}</b> is working.</p>`),
              });
              let result: { success: boolean; error: string | null; delivery: "delivered" | "accepted" } = {
                success: true, error: null, delivery: "accepted",
              };
              const brevoKey = process.env.BREVO_API_KEY;
              if (row!.host === "smtp-relay.brevo.com" && brevoKey) {
                const { confirmBrevoTestDelivery } = await import("@/lib/smtp-delivery.server");
                result = await confirmBrevoTestDelivery(brevoKey, {
                  email: d.to, subject, sentAt, fromEmail: row!.from_email,
                });
              }
              await rest(patchUrl(row!.id), {
                method: "PATCH",
                body: JSON.stringify({ last_error: result.success ? null : result.error, cooldown_until: null, updated_at: now }),
              });
              return Response.json(result);
            } catch (e) {
              return Response.json({ success: false, error: e instanceof Error ? e.message : String(e), delivery: "accepted" });
            }
          }
          return Response.json({ ok: true });
        } catch (e) {
          console.error("smtp-servers failed:", e);
          return Response.json({ error: "Could not save — please try again" }, { status: 500 });
        }
      },
    },
  },
});
