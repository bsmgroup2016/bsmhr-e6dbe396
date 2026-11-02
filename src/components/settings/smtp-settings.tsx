import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Mail, Save, Send, Loader2, CheckCircle2, AlertCircle, ArrowUp, ArrowDown, Pencil, Trash2, Plus, Star, RotateCcw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Server = {
  id: string; label: string; host: string; port: number; secure: boolean; username: string | null;
  fromEmail: string; fromName: string | null; priority: number; enabled: boolean; dailyLimit: number | null;
  sentToday: number; hasPassword: boolean; status: string | null; cooldownUntil: string | null;
  lastError: string | null; lastUsedAt: string | null;
};
type Data = { servers: Server[]; global: { primaryProvider: "resend" | "smtp"; failoverEnabled: boolean }; resendConfigured: boolean };

async function api<T>(method: "GET" | "POST", payload?: Record<string, unknown>): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const res = await fetch("/api/public/smtp-servers", {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` },
    body: payload ? JSON.stringify(payload) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error ?? "Request failed");
  return json as T;
}

const PRESETS: Record<string, { host: string; port: number; secure: boolean }> = {
  Gmail: { host: "smtp.gmail.com", port: 587, secure: false },
  "Outlook / 365": { host: "smtp.office365.com", port: 587, secure: false },
  Zoho: { host: "smtp.zoho.com", port: 465, secure: true },
  Brevo: { host: "smtp-relay.brevo.com", port: 587, secure: false },
  Resend: { host: "smtp.resend.com", port: 465, secure: true },
};

function ServerForm({ initial, onCancel, onSaved }: { initial?: Server; onCancel: () => void; onSaved: () => void }) {
  const [f, setF] = useState({
    label: initial?.label ?? "", host: initial?.host ?? "", port: initial?.port ?? 587, secure: initial?.secure ?? false,
    username: initial?.username ?? "", password: "", fromEmail: initial?.fromEmail ?? "", fromName: initial?.fromName ?? "BSM Workforce",
    enabled: initial?.enabled ?? true, dailyLimit: initial?.dailyLimit ? String(initial.dailyLimit) : "",
  });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f, v: unknown) => setF((p) => ({ ...p, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      await api("POST", {
        action: initial ? "update" : "create",
        ...(initial ? { id: initial.id } : {}),
        ...f,
        port: Number(f.port),
        dailyLimit: f.dailyLimit ? Number(f.dailyLimit) : null,
        password: f.password || undefined,
      });
      toast.success("SMTP saved");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-3 space-y-3 rounded-md border border-dashed bg-muted/40 p-3">
      {!initial && (
        <div className="flex flex-wrap gap-2">
          <span className="self-center text-xs text-muted-foreground">Quick fill:</span>
          {Object.entries(PRESETS).map(([n, p]) => (
            <Button key={n} type="button" variant="outline" size="sm" className="h-7 text-xs"
              onClick={() => setF((x) => ({ ...x, ...p, label: x.label || n }))}>{n}</Button>
          ))}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5"><Label className="text-xs">Name</Label><Input value={f.label} onChange={(e) => set("label", e.target.value)} placeholder="e.g. Gmail main" /></div>
        <div className="space-y-1.5"><Label className="text-xs">Daily limit (blank = no limit)</Label><Input type="number" value={f.dailyLimit} onChange={(e) => set("dailyLimit", e.target.value)} placeholder="e.g. 500" /></div>
        <div className="space-y-1.5"><Label className="text-xs">Host</Label><Input value={f.host} onChange={(e) => set("host", e.target.value)} placeholder="smtp.yourdomain.com" /></div>
        <div className="space-y-1.5"><Label className="text-xs">Port</Label><Input type="number" value={f.port} onChange={(e) => set("port", e.target.value)} /></div>
        <div className="space-y-1.5"><Label className="text-xs">Username</Label><Input value={f.username} onChange={(e) => set("username", e.target.value)} /></div>
        <div className="space-y-1.5">
          <Label className="text-xs">{initial?.hasPassword ? "New password (blank = keep current)" : "Password / API key"}</Label>
          <Input type="password" autoComplete="off" value={f.password} onChange={(e) => set("password", e.target.value)} />
        </div>
        <div className="space-y-1.5"><Label className="text-xs">From email</Label><Input value={f.fromEmail} onChange={(e) => set("fromEmail", e.target.value)} placeholder="no-reply@yourdomain.com" /></div>
        <div className="space-y-1.5"><Label className="text-xs">From name</Label><Input value={f.fromName} onChange={(e) => set("fromName", e.target.value)} /></div>
      </div>
      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2 text-xs"><Switch checked={f.secure} onCheckedChange={(v) => set("secure", v)} /> SSL (port 465)</label>
        <label className="flex items-center gap-2 text-xs"><Switch checked={f.enabled} onCheckedChange={(v) => set("enabled", v)} /> Turned on</label>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
        <Button size="sm" disabled={saving || !f.label || !f.host || !f.fromEmail} onClick={save}>
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Save
        </Button>
      </div>
    </div>
  );
}

function ServerRow({ s, index, total, onChanged }: { s: Server; index: number; total: number; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [testTo, setTestTo] = useState("");
  const [testing, setTesting] = useState(false);

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
      const r = await api<{ success: boolean; error: string | null }>("POST", { action: "test", id: s.id, to: testTo });
      r.success ? toast.success(`Test email sent via ${s.label}`) : toast.error(`${s.label}: ${r.error}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setTesting(false);
    }
  };

  const ready = !s.status;
  return (
    <div className={`rounded-lg border bg-background/50 p-4 ${s.enabled ? "" : "opacity-60"} ${index === 0 && ready ? "border-primary/50" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex flex-col">
            <Button variant="ghost" size="icon" className="h-5 w-5" disabled={busy || index === 0} aria-label="Move up"
              onClick={() => run({ action: "move", id: s.id, direction: "up" }, "Order updated")}><ArrowUp className="h-3 w-3" /></Button>
            <Button variant="ghost" size="icon" className="h-5 w-5" disabled={busy || index === total - 1} aria-label="Move down"
              onClick={() => run({ action: "move", id: s.id, direction: "down" }, "Order updated")}><ArrowDown className="h-3 w-3" /></Button>
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">#{index + 1}</span>
              <span className="font-semibold">{s.label}</span>
              {ready ? (
                <Badge variant="outline" className="gap-1 text-[10px]"><CheckCircle2 className="h-3 w-3 text-primary" /> Ready</Badge>
              ) : (
                <Badge variant="outline" className="gap-1 text-[10px] text-destructive"><AlertCircle className="h-3 w-3" /> {s.status}</Badge>
              )}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {s.host}:{s.port} · {s.fromEmail} · Sent today {s.sentToday}{s.dailyLimit ? ` / ${s.dailyLimit}` : ""}
            </p>
            {s.cooldownUntil && s.status && <p className="text-[11px] text-muted-foreground">Back in use after {new Date(s.cooldownUntil).toLocaleTimeString()}</p>}
            {s.lastError && <p className="mt-0.5 break-all text-[11px] text-destructive">Last error: {s.lastError}</p>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Switch checked={s.enabled} disabled={busy} aria-label="On / off"
            onCheckedChange={(v) => run({ action: "toggle", id: s.id, enabled: v }, v ? "Turned on" : "Turned off")} />
          {index > 0 && (
            <Button variant="outline" size="sm" disabled={busy} onClick={() => run({ action: "move", id: s.id, direction: "top" }, `${s.label} is now the main SMTP`)}>
              <Star className="h-3 w-3" /> Use this first
            </Button>
          )}
          {s.status && s.status !== "Turned off" && (
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => run({ action: "reset", id: s.id }, "Ready again")}>
              <RotateCcw className="h-3 w-3" /> Reset
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => setEditing(!editing)}><Pencil className="h-3 w-3" /> Edit</Button>
          <Button variant="ghost" size="sm" className="text-destructive" disabled={busy} aria-label="Remove"
            onClick={() => confirm(`Remove ${s.label}?`) && run({ action: "delete", id: s.id }, "Removed")}><Trash2 className="h-3 w-3" /></Button>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Input className="h-8 max-w-xs text-xs" type="email" placeholder="Send test email to…" value={testTo} onChange={(e) => setTestTo(e.target.value)} />
        <Button size="sm" variant="outline" disabled={!testTo || testing} onClick={test}>
          {testing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />} Test
        </Button>
      </div>
      {editing && <ServerForm initial={s} onCancel={() => setEditing(false)} onSaved={() => { setEditing(false); onChanged(); }} />}
    </div>
  );
}

export function SmtpSettings() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ["smtp-servers"], queryFn: () => api<Data>("GET") });
  const [adding, setAdding] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: ["smtp-servers"] });

  const setGlobal = async (g: Record<string, unknown>) => {
    try {
      await api("POST", { action: "global", ...g });
      toast.success("Saved");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  if (isLoading) return <div className="p-8 text-center text-sm text-muted-foreground">Loading SMTP…</div>;
  if (error || !data) return <div className="rounded-xl border bg-card p-5 text-sm text-destructive">{(error as Error)?.message ?? "Failed"}</div>;
  const readyCount = data.servers.filter((s) => !s.status).length;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2"><Mail className="h-5 w-5 text-primary" /><h2 className="text-lg font-semibold">Email delivery</h2></div>
          <Badge variant="outline">{readyCount} of {data.servers.length} SMTP ready</Badge>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          Emails go through the first ready SMTP server. If it fails or reaches its limit, the next one takes over automatically,
          and it comes back into use once it is ready again (next day for a daily limit, 1 hour after a provider limit, 5 minutes after an error).
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Main sender</Label>
            <Select value={data.global.primaryProvider} onValueChange={(v) => setGlobal({ primaryProvider: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="smtp">My SMTP servers</SelectItem>
                <SelectItem value="resend">Resend{data.resendConfigured ? "" : " (not set up)"}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center justify-between gap-3 rounded-lg border bg-background/50 p-3">
            <span>
              <span className="block text-sm font-medium">Use the other sender as backup</span>
              <span className="text-xs text-muted-foreground">If every SMTP fails, try Resend (or the reverse).</span>
            </span>
            <Switch checked={data.global.failoverEnabled} onCheckedChange={(v) => setGlobal({ failoverEnabled: v })} />
          </label>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <h2 className="mb-1 text-lg font-semibold">SMTP servers</h2>
        <p className="mb-4 text-sm text-muted-foreground">Tried from top to bottom. Use the arrows or "Use this first" to switch.</p>
        <div className="space-y-3">
          {data.servers.map((s, i) => <ServerRow key={s.id} s={s} index={i} total={data.servers.length} onChanged={refresh} />)}
          {data.servers.length === 0 && <p className="text-sm text-muted-foreground">No SMTP server added yet.</p>}
        </div>
        {adding ? (
          <ServerForm onCancel={() => setAdding(false)} onSaved={() => { setAdding(false); refresh(); }} />
        ) : (
          <Button variant="outline" className="mt-4 w-full border-dashed" onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Add SMTP server</Button>
        )}
      </div>
    </div>
  );
}
