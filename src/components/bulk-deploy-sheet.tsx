import { useMemo, useState } from "react";
import { Search, Users, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { hasExpiredWorkPermit } from "@/lib/availability";
import type { Employee, Project, Site } from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pool: Employee[];
  projects: Project[];
  sites: Site[];
  onDeploy: (employeeIds: string[], projectId: string, siteId: string, startDate: string, remarks?: string) => void;
}

const daysLeft = (iso?: string) => {
  if (!iso) return null;
  const t = new Date(`${iso}T23:59:59+08:00`).getTime();
  if (Number.isNaN(t)) return null;
  return Math.ceil((t - Date.now()) / 86_400_000);
};

export function BulkDeploySheet({ open, onOpenChange, pool, projects, sites, onDeploy }: Props) {
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const projectSites = sites.filter((s) => s.projectId === projectId);
  const [siteId, setSiteId] = useState(projectSites[0]?.id ?? "");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [remarks, setRemarks] = useState("");
  const [search, setSearch] = useState("");
  const [trade, setTrade] = useState("all");
  const [picked, setPicked] = useState<string[]>([]);

  const trades = useMemo(
    () => Array.from(new Set(pool.map((e) => e.trade).filter(Boolean))).sort(),
    [pool],
  );

  const q = search.trim().toLowerCase();
  const visible = pool.filter(
    (e) =>
      (trade === "all" || e.trade === trade) &&
      (!q || e.name.toLowerCase().includes(q) || e.employeeCode.toLowerCase().includes(q) || (e.trade ?? "").toLowerCase().includes(q)),
  );

  function toggle(id: string) {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  function submit() {
    const site = siteId || projectSites[0]?.id;
    if (!projectId || !site) return toast.error("Select a project and site");
    if (picked.length === 0) return toast.error("Select at least one worker");
    onDeploy(picked, projectId, site, startDate, remarks || undefined);
    setPicked([]);
    setRemarks("");
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Bulk deployment</SheetTitle>
          <SheetDescription>
            Deploy several available workers to one site in a single request. Workers with an expired Work Permit are excluded automatically.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Project</Label>
            <Select
              value={projectId}
              onValueChange={(v) => {
                setProjectId(v);
                setSiteId(sites.find((s) => s.projectId === v)?.id ?? "");
              }}
            >
              <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
              <SelectContent>
                {projects.map((p) => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Site</Label>
            <Select value={siteId} onValueChange={setSiteId}>
              <SelectTrigger><SelectValue placeholder="Select site" /></SelectTrigger>
              <SelectContent>
                {projectSites.map((s) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Start date</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Remarks</Label>
            <Input value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Optional" />
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search available workers..."
              className="pl-9"
            />
          </div>
          <Select value={trade} onValueChange={setTrade}>
            <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Designation" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All designations</SelectItem>
              {trades.map((t) => (<SelectItem key={t} value={t}>{t}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" /> {visible.length} available · {picked.length} selected
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setPicked(visible.map((e) => e.id))}>Select all</Button>
            <Button size="sm" variant="ghost" onClick={() => setPicked([])}>Clear</Button>
          </div>
        </div>

        <div className="mt-2 flex-1 space-y-1.5 overflow-y-auto rounded-lg border p-2">
          {visible.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">No available workers match this filter.</p>
          ) : (
            visible.map((e) => {
              const left = daysLeft(e.workPermitExpiryDate);
              return (
                <label
                  key={e.id}
                  className="flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm hover:bg-muted/40"
                >
                  <Checkbox checked={picked.includes(e.id)} onCheckedChange={() => toggle(e.id)} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{e.name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {e.employeeCode} · {e.trade || "—"} · {e.passType}
                    </div>
                  </div>
                  {left !== null && left <= 60 && !hasExpiredWorkPermit(e) && (
                    <StatusBadge variant={left <= 30 ? "destructive" : "warning"} label={`WP ${left}d`} dot />
                  )}
                </label>
              );
            })
          )}
        </div>

        <div className="mt-4 flex items-center justify-between gap-2 border-t pt-4">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <AlertTriangle className="h-3.5 w-3.5" /> Deployments are created as Pending for approval.
          </span>
          <Button onClick={submit} disabled={picked.length === 0}>
            Deploy {picked.length > 0 ? `${picked.length} worker${picked.length === 1 ? "" : "s"}` : ""}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
