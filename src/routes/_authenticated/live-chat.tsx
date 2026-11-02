import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Bot, Send, XCircle } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { liveChatFetch, MessageBubble, type ChatMessage } from "@/components/live-chat-widget";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/live-chat")({
  head: () => ({
    meta: [
      { title: "Live Chat Inbox — BSM Workforce & Operations" },
      { name: "description", content: "See staff chats with the AI assistant and reply as a team member." },
      { property: "og:title", content: "Live Chat Inbox — BSM Workforce & Operations" },
      { property: "og:description", content: "See staff chats with the AI assistant and reply as a team member." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InboxPage,
});

type Chat = { id: string; user_email: string | null; status: "ai" | "human" | "closed"; unread_agent: boolean; updated_at: string };

function InboxPage() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const d = await liveChatFetch(`?inbox=1${active ? `&chat=${active}` : ""}`);
      setChats(d.chats ?? []);
      setMessages(d.messages ?? []);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, [active]);

  useEffect(() => {
    void load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load]);
  useEffect(() => endRef.current?.scrollIntoView(), [messages.length]);

  async function act(payload: Record<string, unknown>) {
    setBusy(true);
    try {
      await liveChatFetch("", { method: "POST", body: JSON.stringify(payload) });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }
  const current = chats.find((c) => c.id === active);
  const statusBadge = (s: Chat["status"]) =>
    s === "human" ? <Badge>Team</Badge> : s === "ai" ? <Badge variant="secondary">AI</Badge> : <Badge variant="outline">Closed</Badge>;

  return (
    <AppShell>
      <div className="mb-5">
        <h1 className="text-2xl font-semibold">Live Chat Inbox</h1>
        <p className="text-sm text-muted-foreground">Staff chats with the AI assistant. Reply to take over; hand back to let the AI continue.</p>
      </div>
      {error && <p className="mb-3 text-sm text-destructive">{error}</p>}
      <div className="grid gap-4 md:grid-cols-[300px_1fr]">
        <Card className="max-h-[70vh] overflow-y-auto p-2">
          {chats.length === 0 && <p className="p-4 text-sm text-muted-foreground">No chats yet.</p>}
          {chats.map((c) => (
            <button
              key={c.id}
              onClick={() => setActive(c.id)}
              className={cn("flex w-full items-center gap-2 rounded-lg p-3 text-left hover:bg-muted", active === c.id && "bg-muted")}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{c.user_email || "Staff member"}</p>
                <p className="text-xs text-muted-foreground">{new Date(c.updated_at).toLocaleString("en-SG")}</p>
              </div>
              {c.unread_agent && <span className="h-2 w-2 rounded-full bg-destructive" />}
              {statusBadge(c.status)}
            </button>
          ))}
        </Card>
        <Card className="flex h-[70vh] flex-col">
          {!current ? (
            <p className="m-auto text-sm text-muted-foreground">Select a chat on the left.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 border-b p-3">
                <p className="flex-1 text-sm font-medium">{current.user_email}</p>
                {current.status === "human" && (
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => act({ action: "handback", chatId: current.id })}>
                    <Bot className="mr-1 h-4 w-4" /> Hand back to AI
                  </Button>
                )}
                {current.status !== "closed" && (
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => act({ action: "close", chatId: current.id })}>
                    <XCircle className="mr-1 h-4 w-4" /> Close
                  </Button>
                )}
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {messages.map((m) => <MessageBubble key={m.id} m={m} mine={m.sender === "agent"} />)}
                <div ref={endRef} />
              </div>
              {current.status !== "closed" && (
                <div className="flex gap-2 border-t p-3">
                  <Textarea
                    rows={2}
                    value={input}
                    placeholder="Reply as the support team… (the AI will pause)"
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey && input.trim()) {
                        e.preventDefault();
                        const content = input.trim();
                        setInput("");
                        void act({ action: "reply", chatId: current.id, content });
                      }
                    }}
                  />
                  <Button
                    disabled={busy || !input.trim()}
                    onClick={() => { const content = input.trim(); setInput(""); void act({ action: "reply", chatId: current.id, content }); }}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
