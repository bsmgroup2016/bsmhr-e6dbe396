import { useCallback, useEffect, useRef, useState } from "react";
import { Headset, Loader2, MessageCircle, Plus, Send, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { hasAssignedRole } from "@/core/access";
import { cn } from "@/lib/utils";

export type ChatMessage = { id: string; sender: "user" | "ai" | "agent" | "system"; content: string; author_name?: string | null; created_at: string };
type Chat = { id: string; status: "ai" | "human" | "closed" } | null;

export async function liveChatFetch(path: string, init?: RequestInit) {
  const { data } = await supabase.auth.getSession();
  const t = data.session?.access_token;
  const res = await fetch(`/api/public/live-chat${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return json;
}

export function MessageBubble({ m, mine }: { m: ChatMessage; mine: boolean }) {
  if (m.sender === "system")
    return <p className="mx-auto max-w-[90%] text-center text-xs text-muted-foreground">{m.content}</p>;
  const label = m.sender === "ai" ? "AI Assistant" : m.sender === "agent" ? m.author_name || "Support team" : "You";
  return (
    <div className={cn("flex flex-col gap-1", mine ? "items-end" : "items-start")}>
      <span className="text-[11px] text-muted-foreground">{mine ? "You" : label}</span>
      <div
        className={cn(
          "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm",
          mine ? "bg-primary text-primary-foreground" : m.sender === "agent" ? "bg-accent text-accent-foreground" : "bg-muted text-foreground",
        )}
      >
        {m.content}
      </div>
    </div>
  );
}

export function LiveChatWidget() {
  const { user, roles } = useAuth();
  const [open, setOpen] = useState(false);
  const [chat, setChat] = useState<Chat>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const allowed = !!user && hasAssignedRole(roles);

  const load = useCallback(async () => {
    try {
      const d = await liveChatFetch("");
      setChat(d.chat);
      setMessages(d.messages ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load chat");
    }
  }, []);

  useEffect(() => {
    if (!open || !allowed) return;
    void load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [open, allowed, load]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, busy]);

  if (!allowed) return null;

  async function post(payload: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      await liveChatFetch("", { method: "POST", body: JSON.stringify(payload) });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    const content = input.trim();
    if (!content || busy) return;
    setInput("");
    setMessages((m) => [...m, { id: `tmp-${Date.now()}`, sender: "user", content, created_at: new Date().toISOString() }]);
    await post({ action: "send", content });
  }

  return (
    <>
      {open && (
        <div className="fixed bottom-24 right-4 z-50 flex h-[min(560px,75vh)] w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl md:bottom-20">
          <div className="flex items-center gap-2 border-b bg-primary px-4 py-3 text-primary-foreground">
            <Headset className="h-5 w-5" />
            <div className="flex-1">
              <p className="text-sm font-semibold">Live Chat</p>
              <p className="text-xs opacity-80">{chat?.status === "human" ? "Talking with our team" : "AI assistant · team can join"}</p>
            </div>
            <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-primary-foreground/10" title="New chat" onClick={() => post({ action: "new" })}>
              <Plus className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-primary-foreground/10" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.length === 0 && (
              <p className="pt-8 text-center text-sm text-muted-foreground">Hi! Ask me anything about workers, payroll, deployments or billing. Need a person? Press “Talk to a person”.</p>
            )}
            {messages.map((m) => <MessageBubble key={m.id} m={m} mine={m.sender === "user"} />)}
            {busy && chat?.status !== "human" && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Typing…</div>
            )}
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div ref={endRef} />
          </div>
          <div className="space-y-2 border-t p-3">
            {chat?.status !== "human" && (
              <Button variant="outline" size="sm" className="w-full" disabled={busy} onClick={() => post({ action: "request_human" })}>
                <UserRound className="mr-1 h-4 w-4" /> Talk to a person
              </Button>
            )}
            <div className="flex gap-2">
              <Textarea
                autoFocus
                rows={1}
                value={input}
                placeholder="Type a message…"
                className="min-h-10 resize-none"
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
              />
              <Button size="icon" onClick={send} disabled={busy || !input.trim()}><Send className="h-4 w-4" /></Button>
            </div>
          </div>
        </div>
      )}
      <Button
        size="icon"
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-20 right-4 z-50 h-14 w-14 rounded-full shadow-lg md:bottom-6"
        aria-label="Live chat"
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </Button>
    </>
  );
}
