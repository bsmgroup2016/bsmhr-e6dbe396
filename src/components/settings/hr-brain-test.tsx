import { useState } from "react";
import { Brain, Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { callHrBrain } from "@/lib/hrBrain";

export function HrBrainTest() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ text: string; model: string } | null>(null);
  const [error, setError] = useState("");
  async function test() {
    setBusy(true); setError(""); setResult(null);
    try {
      const response = await callHrBrain({ messages: [{ role: "user", content: "Say OK" }], stream: false });
      const text = response.choices[0]?.message.content;
      if (!text) throw new Error("AI Brain returned no text response.");
      setResult({ text, model: response.model });
    } catch (e) { setError(e instanceof Error ? e.message : "AI Brain test failed"); }
    finally { setBusy(false); }
  }
  return (
    <section className="space-y-4 border-t pt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold"><Brain className="size-5 text-primary" />AI Brain</h2>
        <Button variant="outline" disabled={busy} onClick={test}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}Test AI Brain
        </Button>
      </div>
      {error && <p role="alert" className="break-words text-sm text-destructive">{error}</p>}
      {result && <div role="status" className="space-y-2 rounded-md border bg-muted/40 p-3 text-sm">
        <p className="break-words whitespace-pre-wrap">{result.text}</p>
        <p className="break-all text-muted-foreground">Model: <span className="font-mono">{result.model}</span></p>
      </div>}
    </section>
  );
}