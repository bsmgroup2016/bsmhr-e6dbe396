import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bot, ScanLine, Sheet, CheckCircle2, XCircle, Loader2, Play, ChevronDown, ChevronUp,
  ArrowUp, ArrowDown, Pencil, Trash2, Plus, Save,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { HrBrainTest } from "@/components/settings/hr-brain-test";
import { integrationPresetModel } from "@/core/ocr-models";

type Category = "ocr" | "chatbot" | "excel_ai";
type Item = {
  id: string; category: Category; label: string; url: string; model: string;
  priority: number; enabled: boolean; updatedAt: string; keySource: "custom" | "secure" | "none";
};
type TestResult = { ok: boolean; message: string; at: string };

async function api<T>(method: "GET" | "POST", payload?: Record<string, unknown>): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not signed in");
  const res = await fetch("/api/public/api-integrations", {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: payload ? JSON.stringify(payload) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error ?? "Request failed");
  return json as T;
}

const PRESETS: Record<string, { url: string; model: string }> = {
  Gemini: { url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", model: "gemini-3.1-pro-preview" },
  OpenAI: { url: "https://api.openai.com/v1/chat/completions", model: "gpt-5.5" },
  Groq: { url: "https://api.groq.com/openai/v1/chat/completions", model: "openai/gpt-oss-120b" },
  Claude: { url: "https://api.anthropic.com/v1/chat/completions", model: "claude-opus-4-5" },
  OpenRouter: { url: "https://openrouter.ai/api/v1/chat/completions", model: "openai/gpt-4o-mini" },
};

function KeyBadge({ source }: { source: Item["keySource"] }) {
  if (source === "none")
    return <Badge variant="outline" className="gap-1 text-[10px] text-destructive"><XCircle className="h-3 w-3" /> Key missing</Badge>;
  return <Badge variant="outline" className="gap-1 text-[10px]"><CheckCircle2 className="h-3 w-3 text-primary" /> Key added</Badge>;
}

function EditForm(props: {
  category: Category;
  initial?: Partial<Item>;
  isNew?: boolean;
  onCancel: () => void;
  onSave: (v: { label: string; url: string; model: string; enabled: boolean; apiKey?: string; clearKey?: boolean }) => Promise<void>;
  canClearKey?: boolean;
}) {
  const [label, setLabel] = useState(props.initial?.label ?? "");
  const [url, setUrl] = useState(props.initial?.url ?? "");
  const [model, setModel] = useState(props.initial?.model ?? "");
  const [enabled, setEnabled] = useState(props.initial?.enabled ?? true);
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async (clearKey = false) => {
    setSaving(true);
    try {
      await props.onSave({ label, url, model, enabled, apiKey: apiKey || undefined, clearKey });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-3 space-y-3 rounded-md border border-dashed bg-muted/40 p-3">
      {props.isNew && (
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-muted-foreground self-center">Quick fill:</span>
          {Object.entries(PRESETS).map(([n, p]) => (
            <Button key={n} type="button" variant="outline" size="sm" className="h-7 text-xs"
              onClick={() => { setUrl(p.url); setModel(integrationPresetModel(props.category, n, p.model)); if (!label) setLabel(n); }}>{n}</Button>
          ))}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5"><Label className="text-xs">Name</Label><Input value={label} onChange={(e) => setLabel(e.target.value)} /></div>
        <div className="space-y-1.5"><Label className="text-xs">Model</Label><Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="e.g. gpt-4o" /></div>
      </div>
      <div className="space-y-1.5"><Label className="text-xs">API URL</Label><Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://.../chat/completions" /></div>
      <div className="space-y-1.5">
        <Label className="text-xs">{props.isNew ? "API key" : "New API key (leave blank to keep the current one)"}</Label>
        <Input type="password" autoComplete="off" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Paste key" />
      </div>
      <div className="flex items-center gap-2">
        <Switch checked={enabled} onCheckedChange={setEnabled} id="en" />
        <Label htmlFor="en" className="text-xs">Turned on</Label>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        {props.canClearKey && (
          <Button variant="ghost" size="sm" disabled={saving} onClick={() => save(true)}>Use original saved key</Button>
        )}
        <Button variant="ghost" size="sm" onClick={props.onCancel}>Cancel</Button>
        <Button size="sm" disabled={saving || !label || !url || !model || (props.isNew && !apiKey)} onClick={() => save(false)}>
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Save
        </Button>
      </div>
    </div>
  );
}

function ApiRow({ item, index, total, onChanged }: { item: Item; index: number; total: number; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  const run = async (payload: Record<string, unknown>, ok: string) => {
    setBusy(true);
    try {
      await api("POST", payload);
      toast.success(ok);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    setTesting(true);
    try {
      const r = await api<{ success: boolean; error: string | null; model?: string; latencyMs?: number }>("POST", { action: "test", id: item.id });
      const details = [r.model, r.latencyMs === undefined ? null : `${(r.latencyMs / 1000).toFixed(1)}s`].filter(Boolean).join(" · ");
      const res = { ok: r.success, message: r.success ? `Working${details ? ` · ${details}` : ""}` : r.error ?? "Failed", at: new Date().toLocaleTimeString() };
      setResult(res);
      res.ok ? toast.success(`${item.label} is working`) : toast.error(`${item.label}: ${res.message}`);
    } catch (e) {
      setResult({ ok: false, message: e instanceof Error ? e.message : "Failed", at: new Date().toLocaleTimeString() });
    } finally {
      setTesting(false);
    }
  };

  const role = index === 0 ? "Used first" : `Takes over if #${index} fails or runs out`;

  return (
    <div className={`rounded-lg border bg-background/50 p-4 ${item.enabled ? "" : "opacity-60"}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex flex-col">
            <Button variant="ghost" size="icon" className="h-5 w-5" disabled={busy || index === 0}
              onClick={() => run({ action: "move", id: item.id, direction: "up" }, "Order updated")} aria-label="Move up"><ArrowUp className="h-3 w-3" /></Button>
            <Button variant="ghost" size="icon" className="h-5 w-5" disabled={busy || index === total - 1}
              onClick={() => run({ action: "move", id: item.id, direction: "down" }, "Order updated")} aria-label="Move down"><ArrowDown className="h-3 w-3" /></Button>
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">#{index + 1}</span>
              <span className="font-semibold">{item.label}</span>
              <KeyBadge source={item.keySource} />
              {!item.enabled && <Badge variant="secondary" className="text-[10px]">Off</Badge>}
              {result && <Badge variant={result.ok ? "secondary" : "destructive"} className="text-[10px]">Test: {result.ok ? "Passed" : "Failed"}</Badge>}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">{item.enabled ? role : "Skipped while off"} · <span className="font-mono">{item.model}</span></p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Switch checked={item.enabled} disabled={busy}
            onCheckedChange={(v) => run({ action: "update", id: item.id, enabled: v }, v ? "Turned on" : "Turned off")} aria-label="On / off" />
          <Button variant="ghost" size="sm" onClick={() => setOpen(!open)}>
            {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />} Details
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setEditing(!editing)}><Pencil className="h-3 w-3" /> Edit</Button>
          <Button variant="outline" size="sm" disabled={item.keySource === "none" || testing} onClick={test}>
            {testing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />} Test
          </Button>
          <Button variant="ghost" size="sm" className="text-destructive" disabled={busy}
            onClick={() => confirm(`Remove ${item.label}?`) && run({ action: "delete", id: item.id }, "Removed")} aria-label="Remove">
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {open && (
        <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 rounded-md bg-muted/40 p-3 text-xs sm:grid-cols-[140px_1fr]">
          {([
            ["Fallback position", `#${index + 1} of ${total}`],
            ["Model", item.model],
            ["API URL", item.url],
            ["Key", item.keySource === "custom" ? "Added here (hidden)" : item.keySource === "secure" ? "Original saved key (hidden)" : "Not added"],
            ["Last changed", new Date(item.updatedAt).toLocaleString()],
          ] as const).map(([k, v]) => (
            <div key={k} className="contents"><dt className="text-muted-foreground">{k}</dt><dd className="break-all font-mono">{v}</dd></div>
          ))}
          {result && (
            <div className="contents"><dt className="text-muted-foreground">Last test</dt>
              <dd className={result.ok ? "" : "text-destructive"}>{result.at} — {result.message}</dd></div>
          )}
        </dl>
      )}

      {editing && (
        <EditForm
          category={item.category}
          initial={item}
          canClearKey={item.keySource === "custom"}
          onCancel={() => setEditing(false)}
          onSave={async (v) => {
            await run({ action: "update", id: item.id, ...v }, "Saved");
            setEditing(false);
          }}
        />
      )}
    </div>
  );
}

function Section({ category, title, description, icon: Icon, items, onChanged }: {
  category: Category; title: string; description: string; icon: typeof Bot; items: Item[]; onChanged: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const list = items.filter((i) => i.category === category).sort((a, b) => a.priority - b.priority);
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="mb-1 flex items-center gap-2"><Icon className="h-5 w-5 text-primary" /><h2 className="text-lg font-semibold">{title}</h2></div>
      <p className="mb-5 text-sm text-muted-foreground">{description}</p>
      <div className="space-y-3">
        {list.map((item, i) => <ApiRow key={item.id} item={item} index={i} total={list.length} onChanged={onChanged} />)}
        {list.length === 0 && <p className="text-sm text-muted-foreground">No API added yet.</p>}
      </div>
      {adding ? (
        <EditForm category={category} isNew onCancel={() => setAdding(false)} onSave={async (v) => {
          try {
            await api("POST", { action: "create", category, ...v });
            toast.success("API added");
            setAdding(false);
            onChanged();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Failed");
          }
        }} />
      ) : (
        <Button variant="outline" className="mt-4 w-full border-dashed" onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Add API</Button>
      )}
    </div>
  );
}

export function ApiIntegrationSettings() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["api-integrations"],
    queryFn: () => api<{ items: Item[] }>("GET"),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["api-integrations"] });

  if (isLoading) return <div className="p-8 text-center text-sm text-muted-foreground">Loading APIs…</div>;
  if (error) return <div className="rounded-xl border bg-card p-5 text-sm text-destructive">{(error as Error).message}</div>;
  const items = data?.items ?? [];

  return (
    <div className="space-y-4">
      <Section category="ocr" title="1. OCR" icon={ScanLine} items={items} onChanged={refresh}
        description="Scans time cards and documents, fills the claim-sheet Excel and creates claim sheets. Tried top to bottom." />
      <Section category="chatbot" title="2. AI Chatbot" icon={Bot} items={items} onChanged={refresh}
        description="Used only by the AI Assistant. If one runs out, the next one takes over. Never used for OCR." />
      <Section category="excel_ai" title="3. Excel AI (Claude)" icon={Sheet} items={items} onChanged={refresh}
        description="Plans the AI analysis Excel (pivots, XLOOKUP, SUMIFS, flags, review notes). Never used for OCR; hours and pay always come from the software." />
      <HrBrainTest />
    </div>
  );
}
