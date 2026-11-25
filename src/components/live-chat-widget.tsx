import { useCallback, useEffect, useRef, useState } from "react";
import { BrainCircuit, Headset, Loader2, MessageCircle, Plus, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { hasAssignedRole } from "@/core/access";
import { cn } from "@/lib/utils";
import { mergeChatMessages, type ChatCursor } from "@/core/chat-pagination";

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

/** Render plain text with [label](url) and bare https links as clickable links. */
function Linkified({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  const re = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s)]+)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const url = m[2] ?? m[3];
    parts.push(<a key={m.index} href={url} target="_blank" rel="noopener noreferrer" className="font-medium underline">{m[1] ?? "Open link"}</a>);
    last = m.index + m[0].length;
  }
  parts.push(text.slice(last));
  return <>{parts}</>;
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
        <Linkified text={m.content} />
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
  const [hasOlder, setHasOlder] = useState(false);
  const [cursor, setCursor] = useState<ChatCursor | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const chatIdRef = useRef<string | null>(null);
  const loadingRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const skipScrollRef = useRef(false);
  const endRef = useRef<HTMLDivElement>(null);
  const allowed = !!user && hasAssignedRole(roles);
  const isAdmin = hasAssignedRole(roles); // AI Brain toggle: all staff roles
  const [useBrain, setUseBrain] = useState(false);

  const load = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      const d = await liveChatFetch("");
      const changed = chatIdRef.current !== (d.chat?.id ?? null);
      chatIdRef.current = d.chat?.id ?? null;
      setChat(d.chat);
      setMessages((current) => changed ? d.messages ?? [] : mergeChatMessages(current.filter((m) => !m.id.startsWith("tmp-")), d.messages ?? []));
      if (changed || !chatIdRef.current) { setHasOlder(d.hasOlder ?? false); setCursor(d.nextCursor ?? null); }
      else { setCursor((current) => current ?? d.nextCursor ?? null); }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load chat");
    } finally {
      loadingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!open || !allowed) return;
    void load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [open, allowed, load]);

  useEffect(() => {
    if (skipScrollRef.current) { skipScrollRef.current = false; return; }
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, busy]);

  useEffect(() => {
    chatIdRef.current = null;
    setMessages([]); setChat(null); setHasOlder(false); setCursor(null);
  }, [user?.id]);

  async function loadOlder() {
    if (!cursor || loadingOlder) return;
    const currentChat = chatIdRef.current;
    const height = scrollRef.current?.scrollHeight ?? 0;
    const top = scrollRef.current?.scrollTop ?? 0;
    setLoadingOlder(true);
    try {
      const query = new URLSearchParams({ beforeAt: cursor.createdAt, beforeId: cursor.id });
      const d = await liveChatFetch(`?${query}`);
      if (chatIdRef.current !== currentChat || d.chat?.id !== currentChat) return;
      skipScrollRef.current = true;
      setMessages((current) => mergeChatMessages(current, d.messages ?? []));
      setHasOlder(d.hasOlder ?? false); setCursor(d.nextCursor ?? null);
      requestAnimationFrame(() => { if (scrollRef.current) scrollRef.current.scrollTop = top + scrollRef.current.scrollHeight - height; });
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load older messages"); }
    finally { setLoadingOlder(false); }
  }

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
    await post({ action: "send", content, ...(useBrain ? { engine: "hr-brain" } : {}) });
  }

  return (
    <>
      {open && (
        <div className="fixed bottom-40 right-4 z-50 flex h-[min(560px,75vh)] w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl">
          <div className="flex items-center gap-2 border-b bg-primary px-4 py-3 text-primary-foreground">
            <Headset className="h-5 w-5" />
            <div className="flex-1">
              <p className="text-sm font-semibold">Live Chat</p>
              <p className="text-xs opacity-80">{useBrain ? "AI Brain" : "AI assistant"} · ask anything</p>
            </div>
            {isAdmin && (
              <Button
                size="icon"
                variant="ghost"
                className={cn("h-8 w-8 hover:bg-primary-foreground/10", useBrain && "bg-primary-foreground/20")}
                title={useBrain ? "AI Brain on — click to use the default assistant" : "Use AI Brain for replies"}
                aria-pressed={useBrain}
                onClick={() => setUseBrain((v) => !v)}
              >
                <BrainCircuit className="h-4 w-4" />
              </Button>
            )}
            <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-primary-foreground/10" title="New chat" onClick={() => post({ action: "new" })}>
              <Plus className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-primary-foreground/10" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
            {hasOlder && <Button variant="ghost" size="sm" className="w-full" disabled={loadingOlder} onClick={() => void loadOlder()}>{loadingOlder ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}Load older</Button>}
            {messages.length === 0 && (
              <p className="pt-8 text-center text-sm text-muted-foreground">Hi! Ask me anything about workers, payroll, deployments or billing.</p>
            )}
            {messages.map((m) => <MessageBubble key={m.id} m={m} mine={m.sender === "user"} />)}
            {busy && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Typing…</div>
            )}
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div ref={endRef} />
          </div>
          <div className="space-y-2 border-t p-3">
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
        className="fixed bottom-24 right-4 z-50 h-14 w-14 rounded-full shadow-lg"
        aria-label="Live chat"
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </Button>
    </>
  );
}
