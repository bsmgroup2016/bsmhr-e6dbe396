import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { verifyUser } from "@/lib/r2.server";

const SUPABASE_URL = "https://thrfyeyqafmdnpexgmlc.supabase.co";

function serviceHeaders() {
  const key = process.env.SB_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Service key missing");
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

async function rest<T = unknown>(path: string, init?: RequestInit): Promise<T[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { ...serviceHeaders(), ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  const text = await res.text();
  return text ? (JSON.parse(text) as T[]) : [];
}

async function isAdmin(userId: string) {
  const rows = await rest<{ role: string }>(
    `user_roles?select=role&user_id=eq.${userId}&role=eq.admin`,
  );
  return rows.length > 0;
}

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("record-login") }),
  z.object({
    action: z.literal("create"),
    email: z.string().email(),
    password: z.string().min(8).max(72),
    fullName: z.string().max(120).optional(),
    phone: z.string().max(40).optional(),
    role: z.string().max(40).optional(),
  }),
  z.object({ action: z.literal("delete"), ids: z.array(z.string().uuid()).min(1).max(50) }),
  z.object({
    action: z.literal("update"),
    id: z.string().uuid(),
    fullName: z.string().max(120).optional(),
    phone: z.string().max(40).optional(),
  }),
]);

function clientIp(request: Request) {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null
  );
}

export const Route = createFileRoute("/api/public/user-admin")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const userId = await verifyUser(request);
        if (!userId) return new Response("Unauthorized", { status: 401 });

        let body: z.infer<typeof bodySchema>;
        try {
          body = bodySchema.parse(await request.json());
        } catch {
          return new Response("Invalid request", { status: 400 });
        }

        try {
          // Any signed-in user may stamp their OWN last login.
          if (body.action === "record-login") {
            await rest(`profiles?id=eq.${userId}`, {
              method: "PATCH",
              body: JSON.stringify({
                last_login_at: new Date().toISOString(),
                last_login_ip: clientIp(request),
              }),
            });
            return Response.json({ ok: true });
          }

          // Everything else is admin-only.
          if (!(await isAdmin(userId))) return new Response("Forbidden", { status: 403 });

          if (body.action === "create") {
            const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
              method: "POST",
              headers: serviceHeaders(),
              body: JSON.stringify({
                email: body.email,
                password: body.password,
                email_confirm: true,
                user_metadata: { full_name: body.fullName ?? "", phone: body.phone ?? "" },
              }),
            });
            if (!res.ok) {
              return Response.json({ error: await res.text() }, { status: 400 });
            }
            const created = (await res.json()) as { id: string };
            await rest(`profiles?id=eq.${created.id}`, {
              method: "PATCH",
              body: JSON.stringify({
                email: body.email,
                full_name: body.fullName ?? null,
                phone: body.phone ?? null,
                is_active: true,
              }),
            });
            if (body.role && body.role !== "none") {
              await rest(`user_roles`, {
                method: "POST",
                body: JSON.stringify({ user_id: created.id, role: body.role }),
              });
            }
            return Response.json({ id: created.id });
          }

          if (body.action === "update") {
            await rest(`profiles?id=eq.${body.id}`, {
              method: "PATCH",
              body: JSON.stringify({
                full_name: body.fullName ?? null,
                phone: body.phone ?? null,
              }),
            });
            return Response.json({ ok: true });
          }

          // delete
          const ids = body.ids.filter((id) => id !== userId);
          if (ids.length === 0) return Response.json({ error: "Cannot delete yourself" }, { status: 400 });
          for (const id of ids) {
            await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${id}`, {
              method: "DELETE",
              headers: serviceHeaders(),
            });
          }
          return Response.json({ deleted: ids.length });
        } catch (e) {
          console.error("user-admin failed", e);
          return Response.json({ error: "Request failed" }, { status: 500 });
        }
      },
    },
  },
});
