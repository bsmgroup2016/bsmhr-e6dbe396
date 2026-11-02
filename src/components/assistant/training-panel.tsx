import { useCallback, useEffect, useState } from "react";
import { BookOpen, Brain, Database, Loader2, Pencil, Plus, RefreshCw, Sparkles as Wand, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";

type Knowledge = { id: string; kind: "snapshot" | "note" | "skill"; source: string; title: string; content: string; enabled: boolean; updated_at: string };
type Run = { id: string; trigger: string; status: string; tables_scanned: number; rows_seen: number; skills_generated: number; provider: string | null; error: string | null; started_at: string; finished_at: string | null };
type Data = {
  settings: { crawls_per_day: number; auto_skills: boolean; skills_generated_at: string | null };
  knowledge: Knowledge[];
  runs: Run[];
  providers: { name: string; model: string; host: string }[];
};

async function api(init?: RequestInit) {
  const { data } = await supabase.auth.getSession();
  const t = data.session?.access_token;
  const res = await fetch("/api/public/ai-training", {
    ...init,
    headers: { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return json;
}
const when = (s: string | null) => (s ? new Date(s).toLocaleString("en-SG") : "—");

export function TrainingPanel() {
  const [d, setD] = useState<Data | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ id?: string; kind: "note" | "skill"; title: string; content: string } | null>(null);

  const load = useCallback(async () => {
    try { setD(await api()); } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to load"); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function act(key: string, payload: Record<string, unknown>, ok?: string) {
    setBusy(key);
    try {
      await api({ method: "POST", body: JSON.stringify(payload) });
      if (ok) toast.success(ok);
      await load();
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
      return false;
    } finally {
      setBusy(null);
    }
  }

  if (!d) return <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  const by = (k: Knowledge["kind"]) => d.knowledge.filter((x) => x.kind === k);
  const lastRun = d.runs[0];

  const list = (items: Knowledge[], editable: boolean) => (
    <div className="space-y-2">
      {items.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Nothing here yet.</p>}
      {items.map((k) => (
        <div key={k.id} className="rounded-lg border p-3">
          <div className="flex items-center gap-2">
            <p className="flex-1 text-sm font-medium">{k.title}</p>
            {k.kind === "skill" && <Badge variant="outline">{k.source === "ai" ? "AI made" : "Manual"}</Badge>}
            <Switch checked={k.enabled} onCheckedChange={(v) => act(k.id, { action: "update", id: k.id, enabled: v })} />
            {editable && (
              <>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setDraft({ id: k.id, kind: k.kind as "note" | "skill", title: k.title, content: k.content })}><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => act(k.id, { action: "delete", id: k.id }, "Removed")}><Trash2 className="h-4 w-4" /></Button>
              </>
            )}
          </div>
          <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{k.content}</p>
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Brain className="h-4 w-4" /> Models in use</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {d.providers.length === 0 && <p className="text-destructive">No chatbot API is on. Add one in Settings → API Integration.</p>}
            {d.providers.map((p, i) => (
              <div key={i} className="flex items-center justify-between gap-2">
                <span><span className="text-muted-foreground">{i + 1}.</span> {p.name}</span>
                <Badge variant="secondary" className="font-mono text-[11px]">{p.model}</Badge>
              </div>
            ))}
            <p className="pt-1 text-xs text-muted-foreground">Tried in this order. If one fails or runs out, the next one answers.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Database className="h-4 w-4" /> Last crawl</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            {lastRun ? (
              <>
                <p>{when(lastRun.started_at)} <Badge variant={lastRun.status === "done" ? "secondary" : lastRun.status === "running" ? "outline" : "destructive"}>{lastRun.status}</Badge></p>
                <p className="text-muted-foreground">{lastRun.tables_scanned} tables · {lastRun.rows_seen.toLocaleString()} records · {lastRun.skills_generated} skills</p>
              </>
            ) : <p className="text-muted-foreground">Never crawled yet.</p>}
            <Button className="mt-2 w-full" disabled={!!busy} onClick={() => act("crawl", { action: "crawl", skills: true }, "Crawl finished")}>
              {busy === "crawl" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1 h-4 w-4" />} Crawl now
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Auto training</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="space-y-1">
              <Label>Auto crawl per day</Label>
              <Select value={String(d.settings.crawls_per_day)} onValueChange={(v) => act("s", { action: "settings", crawls_per_day: Number(v), auto_skills: d.settings.auto_skills }, "Saved")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[0, 1, 2, 3, 4, 6, 8, 12, 24].map((n) => <SelectItem key={n} value={String(n)}>{n === 0 ? "Off" : `${n} times`}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label>Make new skills daily with AI</Label>
              <Switch checked={d.settings.auto_skills} onCheckedChange={(v) => act("s", { action: "settings", crawls_per_day: d.settings.crawls_per_day, auto_skills: v }, "Saved")} />
            </div>
            <p className="text-xs text-muted-foreground">Skills last made: {when(d.settings.skills_generated_at)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">How the chatbot works</CardTitle>
          <CardDescription>
            1) A crawl reads every part of the system (workers, payroll, clients, dorms, vehicles…) and saves a summary of each table.
            2) AI turns that into skills: short recipes for finding answers. 3) On every question the chatbot gets your notes, skills and the database map, then looks up live data itself.
            It only sees what the person asking is allowed to see.
          </CardDescription>
        </CardHeader>
      </Card>

      {draft && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">{draft.id ? "Edit" : "Add"} {draft.kind === "note" ? "knowledge note" : "skill"}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Input placeholder="Title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            <Textarea rows={5} placeholder={draft.kind === "note" ? "e.g. Our levy for R1 workers is $300/month. Payday is the 7th." : "e.g. For expiring permits: query employees, filter wp_expiry between today and +60 days."} value={draft.content} onChange={(e) => setDraft({ ...draft, content: e.target.value })} />
            <div className="flex gap-2">
              <Button
                disabled={!!busy || !draft.title.trim() || !draft.content.trim()}
                onClick={async () => {
                  const ok = await act("save", draft.id ? { action: "update", id: draft.id, title: draft.title, content: draft.content } : { action: "add", kind: draft.kind, title: draft.title, content: draft.content }, "Saved");
                  if (ok) setDraft(null);
                }}
              >Save</Button>
              <Button variant="ghost" onClick={() => setDraft(null)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="skills">
        <TabsList className="flex h-auto flex-wrap justify-start gap-1">
          <TabsTrigger value="skills">Skills ({by("skill").length})</TabsTrigger>
          <TabsTrigger value="notes">Knowledge notes ({by("note").length})</TabsTrigger>
          <TabsTrigger value="map">Database map ({by("snapshot").length})</TabsTrigger>
          <TabsTrigger value="history">Crawl history</TabsTrigger>
        </TabsList>
        <TabsContent value="skills" className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={!!busy} onClick={() => act("gen", { action: "generate_skills" }, "New skills made")}>
              {busy === "gen" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Wand className="mr-1 h-4 w-4" />} Generate skills with AI
            </Button>
            <Button variant="outline" onClick={() => setDraft({ kind: "skill", title: "", content: "" })}><Plus className="mr-1 h-4 w-4" /> Add skill</Button>
          </div>
          <p className="text-xs text-muted-foreground">AI-made skills are replaced each time new ones are generated. Edit a skill to keep it permanently.</p>
          {list(by("skill"), true)}
        </TabsContent>
        <TabsContent value="notes" className="space-y-3">
          <Button variant="outline" onClick={() => setDraft({ kind: "note", title: "", content: "" })}><BookOpen className="mr-1 h-4 w-4" /> Add knowledge note</Button>
          <p className="text-xs text-muted-foreground">Teach the chatbot company rules, policies and facts that are not in the database.</p>
          {list(by("note"), true)}
        </TabsContent>
        <TabsContent value="map">{list(by("snapshot"), false)}</TabsContent>
        <TabsContent value="history">
          <Card><CardContent className="divide-y p-0">
            {d.runs.length === 0 && <p className="p-4 text-sm text-muted-foreground">No crawls yet.</p>}
            {d.runs.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-2 p-3 text-sm">
                <span className="w-44">{when(r.started_at)}</span>
                <Badge variant="outline">{r.trigger === "auto" ? "Auto" : "Manual"}</Badge>
                <Badge variant={r.status === "done" ? "secondary" : r.status === "running" ? "outline" : "destructive"}>{r.status}</Badge>
                <span className="text-muted-foreground">{r.tables_scanned} tables · {r.rows_seen.toLocaleString()} records · {r.skills_generated} skills{r.provider ? ` · ${r.provider}` : ""}</span>
                {r.error && <span className="w-full text-xs text-destructive">{r.error}</span>}
              </div>
            ))}
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
