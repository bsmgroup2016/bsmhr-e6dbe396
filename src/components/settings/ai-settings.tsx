import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bot, ScanLine, CheckCircle2, XCircle, Loader2, Play } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getAiConfig, getAssistantConfig, testAiProvider } from "@/lib/ai-settings.functions";

function StatusBadge({ ok }: { ok: boolean }) {
  return ok ? (
    <Badge variant="outline" className="gap-1 text-[10px]"><CheckCircle2 className="h-3 w-3 text-primary" /> Connected</Badge>
  ) : (
    <Badge variant="outline" className="gap-1 text-[10px] text-destructive"><XCircle className="h-3 w-3" /> Key missing</Badge>
  );
}

/** OCR: paid Gemini + OpenAI only — scans time cards, fills claim-sheet Excel. */
export function OcrSettings() {
  const fetchConfig = useServerFn(getAiConfig);
  const runTest = useServerFn(testAiProvider);
  const [testing, setTesting] = useState<string | null>(null);
  const { data } = useQuery({ queryKey: ["ocr-config"], queryFn: () => fetchConfig() });

  const rows: { name: "gemini" | "openai"; label: string; role: string }[] = [
    { name: "gemini", label: "Google Gemini (paid)", role: "Reads the scanned time card" },
    { name: "openai", label: "OpenAI (paid)", role: "Double-checks the reading and takes over if Gemini fails" },
  ];

  const test = async (name: "gemini" | "openai") => {
    setTesting(name);
    try {
      const res = await runTest({ data: { provider: name } });
      res.success ? toast.success(`${name} is working`) : toast.error(`Test failed: ${res.error}`);
    } finally {
      setTesting(null);
    }
  };

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="mb-1 flex items-center gap-2">
        <ScanLine className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">OCR Engines</h2>
      </div>
      <p className="mb-5 text-sm text-muted-foreground">
        Used only for scanning time cards and documents, filling the claim-sheet Excel and creating claim sheets.
      </p>
      <div className="space-y-3">
        {rows.map((r) => {
          const p = data?.providers.find((x) => x.name === r.name);
          return (
            <div key={r.name} className="flex items-center justify-between gap-3 rounded-lg border bg-background/50 p-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{r.label}</span>
                  <StatusBadge ok={!!p} />
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{r.role}{p ? ` · ${p.model}` : ""}</p>
              </div>
              <Button variant="outline" size="sm" disabled={!p || testing === r.name} onClick={() => test(r.name)}>
                {testing === r.name ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                Test
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** AI chatbot: its own keys, fallback Gemini #1 → Gemini #2 → Groq → OpenRouter. */
export function AiSettings() {
  const fetchConfig = useServerFn(getAssistantConfig);
  const { data } = useQuery({ queryKey: ["assistant-config"], queryFn: () => fetchConfig() });

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="mb-1 flex items-center gap-2">
        <Bot className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">AI Chatbot Keys</h2>
      </div>
      <p className="mb-5 text-sm text-muted-foreground">
        Used only by the AI Assistant. If one key runs out, the next one takes over in this order. These keys are never used for OCR.
      </p>
      <div className="space-y-3">
        {(data ?? []).map((p, i) => (
          <div key={p.name} className="flex items-center justify-between gap-3 rounded-lg border bg-background/50 p-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">#{i + 1}</span>
                <span className="font-semibold">{p.name}</span>
                <StatusBadge ok={p.configured} />
              </div>
              {p.model && <p className="mt-0.5 font-mono text-xs text-muted-foreground">{p.model}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
