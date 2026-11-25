import { useEffect, useState } from "react";
import { Brain, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { callHrBrain } from "@/lib/hrBrain";

const STYLE = "You are AI Brain, a professional HR and accounts assistant for BSM GROUP (Singapore manpower supply). Write in clear, polite, professional English. Use short headings and bullet points. Never invent facts beyond the data given. Amounts are SGD. Dates as DD MMM YYYY.";

/** Reusable AI Brain helper: sends the given task + live screen data and shows an editable, copyable result. */
export function AiBrainAssist({ label, title, task, data, size = "sm" }: { label: string; title: string; task: string; data: () => unknown; size?: "sm" | "default" }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  async function run() {
    setOpen(true); setBusy(true); setText("");
    try {
      const res = await callHrBrain({ systemPrompt: STYLE, messages: [{ role: "user", content: `${task}\n\nData:\n${JSON.stringify(data(), null, 2)}` }], stream: false });
      setText(res.choices?.[0]?.message?.content?.trim() || "AI Brain returned an empty answer.");
    } catch (e) {
      setText(""); toast.error(e instanceof Error ? e.message : "AI Brain request failed"); setOpen(false);
    } finally { setBusy(false); }
  }
  return <>
    <Button type="button" variant="outline" size={size} onClick={() => void run()} disabled={busy}><Brain className="mr-2 h-4 w-4" />{label}</Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>Draft by AI Brain — review before using.</DialogDescription></DialogHeader>
        {busy ? <p role="status" className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" />AI Brain is working…</p>
          : <Textarea value={text} onChange={e => setText(e.target.value)} rows={16} />}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" disabled={busy} onClick={() => void run()}>Regenerate</Button>
          <Button type="button" disabled={busy || !text} onClick={() => void navigator.clipboard.writeText(text).then(() => toast.success("Copied"))}><Copy className="mr-2 h-4 w-4" />Copy</Button>
        </div>
      </DialogContent>
    </Dialog>
  </>;
}

const autoCache = new Map<string, string>();

/** Runs AI Brain automatically when shown (no click needed) and renders the result inline. Cached per data so re-renders don't spend credits. */
export function AiBrainAuto({ title, task, data }: { title: string; task: string; data: unknown }) {
  const key = task + JSON.stringify(data);
  const [text, setText] = useState(() => autoCache.get(key) ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function run(force = false) {
    if (!force && autoCache.has(key)) { setText(autoCache.get(key)!); return; }
    setBusy(true); setError("");
    try {
      const res = await callHrBrain({ systemPrompt: STYLE, messages: [{ role: "user", content: `${task}\n\nData:\n${JSON.stringify(data, null, 2)}` }], stream: false });
      const out = res.choices?.[0]?.message?.content?.trim() || "AI Brain returned an empty answer.";
      autoCache.set(key, out); setText(out);
    } catch (e) { setError(e instanceof Error ? e.message : "AI Brain request failed"); }
    finally { setBusy(false); }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void run(); }, [key]);
  return <div className="space-y-2 rounded-lg border p-3 text-sm">
    <div className="flex items-center justify-between gap-2">
      <p className="flex items-center gap-2 font-semibold"><Brain className="h-4 w-4" />{title}</p>
      <div className="flex gap-1">
        <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => void run(true)}>Refresh</Button>
        <Button type="button" variant="ghost" size="sm" disabled={busy || !text} onClick={() => void navigator.clipboard.writeText(text).then(() => toast.success("Copied"))}><Copy className="h-4 w-4" /></Button>
      </div>
    </div>
    {busy ? <p role="status" className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />AI Brain is checking automatically…</p>
      : error ? <p className="text-destructive">{error}</p>
      : <pre className="max-h-72 overflow-y-auto whitespace-pre-wrap font-sans text-xs">{text}</pre>}
  </div>;
}
