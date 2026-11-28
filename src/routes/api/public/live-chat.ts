import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { verifyUser, userRoles } from "@/lib/r2.server";
import { hasAssignedRole } from "@/core/access";
import { chatMessagePage, chatMessageQuery, type ChatCursor, type DatedMessage } from "@/core/chat-pagination";

const SUPABASE_URL = "https://supabase.bsmengg.com";
const ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzk1ODUyMTUwLCJleHAiOjE5NTM1MzIxNTB9.oKHcsh1PF5fehDyqcQn7Ja9epYtV44TXHZdq-X28TLM";
/** Roles that can see the inbox and reply as a human agent. */
const AGENT_ROLES = ["admin", "manager", "hr"];

async function db(path: string, init: RequestInit = {}) {
  const key = process.env.SB_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Service key missing");
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=representation", ...(init.headers ?? {}) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`DB ${res.status}: ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : [];
}

async function userEmail(auth: string) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: ANON, Authorization: auth } });
  return r.ok ? ((await r.json()) as { email?: string }).email ?? null : null;
}

async function openChat(userId: string) {
  const rows = await db(`live_chats?user_id=eq.${userId}&status=neq.closed&order=updated_at.desc&limit=1`);
  return rows[0] ?? null;
}
async function messagesOf(chatId: string, before?: ChatCursor) {
  return chatMessagePage(await db(chatMessageQuery(chatId, before)) as (DatedMessage & { sender: string; content: string })[]);
}
async function addMsg(chatId: string, sender: string, content: string, authorId?: string, authorName?: string | null) {
  await db("live_chat_messages", { method: "POST", body: JSON.stringify({ chat_id: chatId, sender, content, author_id: authorId ?? null, author_name: authorName ?? null }) });
}
const touch = (chatId: string, patch: Record<string, unknown> = {}) =>
  db(`live_chats?id=eq.${chatId}`, { method: "PATCH", body: JSON.stringify({ updated_at: new Date().toISOString(), ...patch }) });

const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("send"), content: z.string().trim().min(1).max(4000), engine: z.literal("hr-brain").optional() }),
  z.object({ action: z.literal("request_human") }),
  z.object({ action: z.literal("new") }),
  z.object({ action: z.literal("reply"), chatId: z.string().uuid(), content: z.string().trim().min(1).max(4000) }),
  z.object({ action: z.literal("handback"), chatId: z.string().uuid() }),
  z.object({ action: z.literal("close"), chatId: z.string().uuid() }),
]);

/** Signed-in staff only. Agents (admin/manager/HR) can view all chats and reply. */
export const Route = createFileRoute("/api/public/live-chat")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const userId = await verifyUser(request);
        if (!userId) return new Response("Unauthorized", { status: 401 });
        const roles = await userRoles(userId);
        if (!hasAssignedRole(roles)) return new Response("Forbidden", { status: 403 });
        const url = new URL(request.url);
        const isAgent = roles.some((r) => AGENT_ROLES.includes(r));
        let before: ChatCursor | undefined;
        if (url.searchParams.has("beforeAt") || url.searchParams.has("beforeId")) {
          const parsed = z.object({ createdAt: z.string().datetime({ offset: true }), id: z.string().uuid() }).safeParse({ createdAt: url.searchParams.get("beforeAt"), id: url.searchParams.get("beforeId") });
          if (!parsed.success) return Response.json({ error: "Invalid message cursor" }, { status: 400 });
          before = parsed.data;
        }
        try {
          if (url.searchParams.get("inbox") === "1") {
            if (!isAgent) return new Response("Forbidden", { status: 403 });
            const chatId = url.searchParams.get("chat");
            const chats = await db("live_chats?order=updated_at.desc&limit=100");
            const page = chatId && /^[0-9a-f-]{36}$/.test(chatId) ? await messagesOf(chatId, before) : { messages: [], hasOlder: false, nextCursor: null };
            return Response.json({ chats, ...page });
          }
          const chat = await openChat(userId);
          const page = chat ? await messagesOf(chat.id, before) : { messages: [], hasOlder: false, nextCursor: null };
          return Response.json({ chat, ...page, isAgent });
        } catch (e) {
          return Response.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
        }
      },
      POST: async ({ request }) => {
        const userId = await verifyUser(request);
        if (!userId) return new Response("Unauthorized", { status: 401 });
        const roles = await userRoles(userId);
        if (!hasAssignedRole(roles)) return new Response("Forbidden", { status: 403 });
        const isAgent = roles.some((r) => AGENT_ROLES.includes(r));
        const auth = request.headers.get("authorization")!;
        let p;
        try { p = body.parse(await request.json()); } catch { return Response.json({ error: "Invalid request" }, { status: 400 }); }
        try {
          if (p.action === "reply" || p.action === "handback" || p.action === "close") {
            if (!isAgent) return new Response("Forbidden", { status: 403 });
            if (p.action === "reply") {
              await addMsg(p.chatId, "agent", p.content, userId, await userEmail(auth));
              await touch(p.chatId, { status: "human", agent_id: userId, unread_agent: false });
            } else if (p.action === "handback") {
              await addMsg(p.chatId, "system", "The support team handed this chat back to the AI assistant.");
              await touch(p.chatId, { status: "ai", unread_agent: false });
            } else {
              await addMsg(p.chatId, "system", "This chat was closed by the support team.");
              await touch(p.chatId, { status: "closed", unread_agent: false });
            }
            return Response.json({ ok: true });
          }
          let chat = await openChat(userId);
          if (p.action === "new") {
            if (chat) await touch(chat.id, { status: "closed" });
            return Response.json({ ok: true });
          }
          if (!chat) chat = (await db("live_chats", { method: "POST", body: JSON.stringify({ user_id: userId, user_email: await userEmail(auth) }) }))[0];
          if (p.action === "request_human") {
            await addMsg(chat.id, "system", "You asked for a team member. Someone will reply here shortly.");
            await touch(chat.id, { status: "human", unread_agent: true });
            return Response.json({ ok: true });
          }
          await addMsg(chat.id, "user", p.content, userId);
          await touch(chat.id);
          const history = (await messagesOf(chat.id)).messages
            .filter((m) => m.sender === "user" || m.sender === "ai" || m.sender === "agent")
            .slice(-30)
            .map((m) => ({ role: m.sender === "user" ? ("user" as const) : ("assistant" as const), content: m.content }));
          try {
            const { runAssistant } = await import("@/lib/assistant.server");
            // AI Brain is optional for every staff role; default chain otherwise.
            const engine = p.action === "send" && p.engine === "hr-brain" && roles.some((r) => ["admin","hr","manager","accounts","it"].includes(r)) ? "hr-brain" : undefined;
            const out = await runAssistant(history, auth, ANON, userId, engine ? { engine } : {});
            await addMsg(chat.id, "ai", out.reply || "(no answer)");
          } catch (e) {
            console.error("live chat AI failed:", e);
            await addMsg(chat.id, "system", "The AI assistant is unavailable right now. Please try again in a moment.");
          }
          await touch(chat.id);
          return Response.json({ ok: true });
        } catch (e) {
          return Response.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
        }
      },
    },
  },
});
