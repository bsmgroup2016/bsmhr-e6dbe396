import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bot, ScanLine, CheckCircle2, XCircle, Loader2, Play, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getAiConfig, getAssistantConfig, testAiProvider, testAssistantKey } from "@/lib/ai-settings.functions";

type TestResult = { ok: boolean; message: string; at: string };

function StatusBadge({ ok }: { ok: boolean }) {
  return ok ? (
    <Badge variant="outline" className="gap-1 text-[10px]"><CheckCircle2 className="h-3 w-3 text-primary" /> Connected</Badge>
  ) : (
    <Badge variant="outline" className="gap-1 text-[10px] text-destructive"><XCircle className="h-3 w-3" /> Key missing</Badge>
  );
}

function ApiRow(props: {
  order: number;
  label: string;
  role: string;
  configured: boolean;
  details: [string, string][];
  onTest: () => Promise<{ success: boolean; error: string | null }>;
}) {
  const [open, setOpen] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  const test = async () => {
    setTesting(true);
    try {
      const r = await props.onTest();
      const res = { ok: r.success, message: r.success ? "Working" : r.error ?? "Failed", at: new Date().toLocaleTimeString() };
      setResult(res);
      res.ok ? toast.success(`${props.label} is working`) : toast.error(`${props.label}: ${res.message}`);
    } catch (e) {
      setResult({ ok: false, message: e instanceof Error ? e.message : String(e), at: new Date().toLocaleTimeString() });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="rounded-lg border bg-background/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">#{props.order}</span>
            <span className="font-semibold">{props.label}</span>
            <StatusBadge ok={props.configured} />
            {result && (
              <Badge variant={result.ok ? "secondary" : "destructive"} className="text-[10px]">
                Test: {result.ok ? "Passed" : "Failed"}
              </Badge>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{props.role}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setOpen(!open)}>
            {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />} Details
          </Button>
          <Button variant="outline" size="sm" disabled={!props.configured || testing} onClick={test}>
            {testing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />} Test
          </Button>
        </div>
      </div>
      {open && (
        <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 rounded-md bg-muted/40 p-3 text-xs sm:grid-cols-[140px_1fr]">
          {props.details.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="break-all font-mono">{v}</dd>
            </div>
          ))}
          {result && (
            <div className="contents">
              <dt className="text-muted-foreground">Last test</dt>
              <dd className={result.ok ? "" : "text-destructive"}>{result.at} — {result.message}</dd>
            </div>
          )}
        </dl>
      )}
    </div>
  );
}

const KEY_NOTE = "Stored securely — keys cannot be viewed. Ask in chat to replace a key.";

/** OCR: paid Gemini + OpenAI only. */
export function OcrSettings() {
  const fetchConfig = useServerFn(getAiConfig);
  const runTest = useServerFn(testAiProvider);
  const { data } = useQuery({ queryKey: ["ocr-config"], queryFn: () => fetchConfig() });

  const rows = [
    { name: "gemini" as const, label: "Google Gemini (paid)", role: "Reads the scanned time card", secret: "GOOGLE_API_KEY", endpoint: "generativelanguage.googleapis.com" },
    { name: "openai" as const, label: "OpenAI (paid)", role: "Double-checks the reading and takes over if Gemini fails", secret: "OPENAI_API_KEY", endpoint: "api.openai.com" },
  ];

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="mb-1 flex items-center gap-2">
        <ScanLine className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">1. OCR</h2>
      </div>
      <p className="mb-5 text-sm text-muted-foreground">
        Scans time cards and documents, fills the claim-sheet Excel and creates claim sheets.
      </p>
      <div className="space-y-3">
        {rows.map((r, i) => {
          const p = data?.providers.find((x) => x.name === r.name);
          return (
            <ApiRow
              key={r.name}
              order={i + 1}
              label={r.label}
              role={r.role}
              configured={!!p}
              details={[
                ["Used for", "OCR, claim-sheet Excel, claim sheets"],
                ["Model", p?.model ?? "—"],
                ["Server", r.endpoint],
                ["Key name", r.secret],
                ["Key", p ? KEY_NOTE : "Not added"],
              ]}
              onTest={() => runTest({ data: { provider: r.name } })}
            />
          );
        })}
      </div>
    </div>
  );
}

/** AI chatbot: own keys, fallback Gemini #1 → Gemini #2 → Groq → OpenRouter. */
export function AiSettings() {
  const fetchConfig = useServerFn(getAssistantConfig);
  const runTest = useServerFn(testAssistantKey);
  const { data } = useQuery({ queryKey: ["assistant-config"], queryFn: () => fetchConfig() });
  const secretNames: Record<string, string> = {
    "Gemini #1": "ASSISTANT_GEMINI_KEY_1",
    "Gemini #2": "ASSISTANT_GEMINI_KEY_2",
    Groq: "ASSISTANT_GROQ_KEY",
    OpenRouter: "ASSISTANT_OPENROUTER_KEY",
  };

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="mb-1 flex items-center gap-2">
        <Bot className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">2. AI Chatbot</h2>
      </div>
      <p className="mb-5 text-sm text-muted-foreground">
        Used only by the AI Assistant. If one key runs out, the next one takes over in this order. Never used for OCR.
      </p>
      <div className="space-y-3">
        {(data ?? []).map((p, i) => (
          <ApiRow
            key={p.name}
            order={i + 1}
            label={p.name}
            role={i === 0 ? "Answers first" : `Takes over when #${i} runs out`}
            configured={p.configured}
            details={[
              ["Used for", "AI Assistant chat"],
              ["Model", p.model ?? "—"],
              ["Server", p.url ? new URL(p.url).host : "—"],
              ["Key name", secretNames[p.name]],
              ["Key", p.configured ? KEY_NOTE : "Not added"],
            ]}
            onTest={() => runTest({ data: { provider: p.name as "Groq" } })}
          />
        ))}
      </div>
    </div>
  );
}
