import { useState } from "react";
import { Brain, Loader2, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { callHrBrain } from "@/lib/hrBrain";

export function HrBrainTest() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ text: string; model: string } | null>(null);
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  async function test() {
    if (busy) return;
    const started = Date.now();
    setBusy(true); setError(""); setResult(null);
    try {
      const response = await callHrBrain({ messages: [{ role: "user", content: "Say OK" }], stream: false });
      const text = response.choices[0]?.message.content;
      if (!text) throw new Error("AI Brain returned no text response.");
      setResult({ text, model: response.model });
    } catch (e) { setError(e instanceof Error ? e.message : "AI Brain test failed"); }
    finally { setElapsed(Date.now() - started); setBusy(false); }
  }
  return (
    <section className="space-y-4 border-t pt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold"><Brain className="size-5 text-primary" />AI Brain</h2>
        <Button variant="outline" disabled={busy} onClick={test}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}Test AI Brain
        </Button>
      </div>
      {error && <div role="alert" className="space-y-2 border-l-2 border-destructive bg-muted/40 p-3 text-sm">
        <p className="font-semibold text-destructive">AI Brain test failed</p>
        <p className="break-words">{error}</p>
        <p className="text-xs text-muted-foreground">Elapsed: {(elapsed / 1000).toFixed(1)} seconds · No response confirmed</p>
        <Button variant="outline" size="sm" disabled={busy} onClick={test}><RotateCcw className="size-4" />Retry test</Button>
      </div>}
      {result && <div role="status" className="space-y-2 rounded-md border bg-muted/40 p-3 text-sm">
        <p className="break-words whitespace-pre-wrap">{result.text}</p>
        <p className="break-all text-muted-foreground">Model: <span className="font-mono">{result.model}</span></p>
      </div>}
    </section>
  );
}