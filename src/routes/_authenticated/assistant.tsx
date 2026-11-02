import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Bot, Loader2, Send, Trash2, User } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrainingPanel } from "@/components/assistant/training-panel";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/assistant")({
  head: () => ({
    meta: [
      { title: "AI Assistant — BSM Workforce & Operations" },
      { name: "description", content: "Ask questions about workers, payroll, deployments, billing and more in plain language." },
      { property: "og:title", content: "AI Assistant — BSM Workforce & Operations" },
      { property: "og:description", content: "Ask questions about workers, payroll, deployments, billing and more." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AssistantPage,
}));

function AssistantPage() {
  const { isAdmin } = useAuth();
  return (
    <AppShell>
      <Tabs defaultValue="chat" className="mx-auto max-w-5xl">
        {isAdmin && (
          <TabsList className="mb-3">
            <TabsTrigger value="chat">Chat</TabsTrigger>
            <TabsTrigger value="training">Chatbot Training</TabsTrigger>
          </TabsList>
        )}
        <TabsContent value="chat"><ChatPanel /></TabsContent>
        {isAdmin && <TabsContent value="training"><TrainingPanel /></TabsContent>}
      </Tabs>
    </AppShell>
  );
}
const _unused = (() => ({
});

type Msg = { role: "user" | "assistant"; content: string; provider?: string; error?: boolean };

const SUGGESTIONS = [
  "How many active employees do we have?",
  "Which work permits expire in the next 60 days?",
  "List workers not assigned to any project",
  "Total unpaid invoices this month",
];

async function authHeader() {
  const { data } = await supabase.auth.getSession();
  const t = data.session?.access_token;
  return t ? { Authorization: `Bearer ${t}` } : ({} as Record<string, string>);
}

function ChatPanel() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [providers, setProviders] = useState<string[] | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/public/assistant", { headers: await authHeader() });
      if (res.ok) setProviders(((await res.json()).providers as { name: string }[]).map((p) => p.name));
    })();
  }, []);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    const next: Msg[] = [...messages, { role: "user", content: q }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/public/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeader()) },
        body: JSON.stringify({
          messages: next.filter((m) => !m.error).slice(-20).map(({ role, content }) => ({ role, content })),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Assistant failed");
      setMessages([...next, { role: "assistant", content: json.reply, provider: json.provider }]);
    } catch (e) {
      setMessages([...next, { role: "assistant", content: e instanceof Error ? e.message : "Failed", error: true }]);
    } finally {
      setBusy(false);
    }
  }

  return (
      <div className="mx-auto flex h-[calc(100vh-11rem)] max-w-4xl flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">AI Assistant</h1>
            <p className="text-sm text-muted-foreground">Ask anything about your workers, payroll, deployments, billing and more.</p>
          </div>
          <div className="flex items-center gap-2">
            {providers && (
              <Badge variant={providers.length ? "secondary" : "destructive"}>
                {providers.length ? providers.join(" → ") : "No assistant keys set"}
              </Badge>
            )}
            {messages.length > 0 && (
              <Button variant="ghost" size="icon" onClick={() => setMessages([])} aria-label="Clear chat">
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        <Card className="flex-1 overflow-hidden">
          <CardContent className="h-full space-y-4 overflow-y-auto p-4">
            {messages.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                <Bot className="h-10 w-10 text-primary" />
                <p className="text-sm text-muted-foreground">Try one of these:</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {SUGGESTIONS.map((s) => (
                    <Button key={s} variant="outline" size="sm" onClick={() => send(s)}>{s}</Button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-3 ${m.role === "user" ? "justify-end" : ""}`}>
                {m.role === "assistant" && <Bot className="mt-1 h-5 w-5 shrink-0 text-primary" />}
                <div
                  className={`max-w-[80%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
                    m.role === "user" ? "bg-primary text-primary-foreground" : m.error ? "bg-destructive/10 text-destructive" : "bg-muted"
                  }`}
                >
                  {m.content}
                  {m.provider && <div className="mt-1 text-[10px] opacity-60">via {m.provider}</div>}
                </div>
                {m.role === "user" && <User className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />}
              </div>
            ))}
            {busy && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Looking through your data…
              </div>
            )}
            <div ref={endRef} />
          </CardContent>
        </Card>

        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder="Ask a question…"
            className="min-h-[44px] resize-none"
            rows={1}
          />
          <Button type="submit" disabled={busy || !input.trim()} aria-label="Send">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
  );
}
