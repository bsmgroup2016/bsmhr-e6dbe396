import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { History, Search, ArrowLeftRight, LogOut, HardHat, Clock } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { ExportButton } from "@/components/data-io";
import { SummaryCard } from "@/components/ui/summary-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getAssignments, getClients, getEmployees, getProjects, getSites } from "@/lib/store";
import { employeeSlugById } from "@/lib/employee-slug";
import type { AssignmentStatus } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/deployment-history")({
  validateSearch: (search: Record<string, unknown>) => ({
    client: typeof search.client === "string" ? search.client : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Deployment History — BSM Workforce & Operations" },
      { name: "description", content: "Full deployment audit trail: which worker was at which client site, when, for how long, and why they moved." },
      { property: "og:title", content: "Deployment History — BSM Workforce & Operations" },
      { property: "og:description", content: "Timeline of every worker deployment, transfer and off-hire across clients and projects." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DeploymentHistoryPage,
});

const day = 86_400_000;

function duration(start: string, end?: string) {
  const s = new Date(`${start}T00:00:00+08:00`).getTime();
  const e = end ? new Date(`${end}T00:00:00+08:00`).getTime() : Date.now();
  if (Number.isNaN(s) || Number.isNaN(e)) return null;
  return Math.max(0, Math.round((e - s) / day));
}

const statusVariant = (s: AssignmentStatus) =>
  s === "Active" ? "success" : s === "Approved" || s === "Pending" ? "info" : s === "Rejected" ? "danger" : "muted";

function DeploymentHistoryPage() {
  const search = Route.useSearch();
  const employees = getEmployees();
  const projects = getProjects();
  const sites = getSites();
  const clients = getClients();
  const assignments = getAssignments();

  const [q, setQ] = useState("");
  const [clientFilter, setClientFilter] = useState(search.client ?? "all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<AssignmentStatus | "all">("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return assignments
      .map((a) => {
        const emp = employees.find((e) => e.id === a.employeeId);
        const project = projects.find((p) => p.id === a.projectId);
        const client = project ? clients.find((c) => c.id === project.clientId) : undefined;
        return {
          a,
          emp,
          project,
          client,
          site: sites.find((s) => s.id === a.siteId),
          days: duration(a.startDate, a.endDate),
        };
      })
      .filter((r) => {
        if (!r.emp) return false;
        if (term && !(
          r.emp.name.toLowerCase().includes(term) ||
          r.emp.employeeCode.toLowerCase().includes(term) ||
          (r.project?.name ?? "").toLowerCase().includes(term) ||
          (r.a.remarks ?? "").toLowerCase().includes(term)
        )) return false;
        if (clientFilter !== "all" && r.client?.id !== clientFilter) return false;
        if (projectFilter !== "all" && r.a.projectId !== projectFilter) return false;
        if (statusFilter !== "all" && r.a.status !== statusFilter) return false;
        if (from && r.a.startDate < from) return false;
        if (to && r.a.startDate > to) return false;
        return true;
      })
      .sort((x, y) => y.a.startDate.localeCompare(x.a.startDate));
  }, [assignments, employees, projects, sites, clients, q, clientFilter, projectFilter, statusFilter, from, to]);

  const active = rows.filter((r) => r.a.status === "Active" || r.a.status === "Approved").length;
  const transfers = rows.filter((r) => r.a.status === "Transferred").length;
  const ended = rows.filter((r) => r.a.status === "Ended").length;
  const avgDays = rows.length ? Math.round(rows.reduce((s, r) => s + (r.days ?? 0), 0) / rows.length) : 0;

  const timeline = useMemo(() => {
    const byWorker = new Map<string, typeof rows>();
    rows.forEach((r) => {
      const key = r.emp!.id;
      byWorker.set(key, [...(byWorker.get(key) ?? []), r]);
    });
    return Array.from(byWorker.entries())
      .map(([id, list]) => ({
        id,
        emp: list[0].emp!,
        list: [...list].sort((a, b) => a.a.startDate.localeCompare(b.a.startDate)),
      }))
      .sort((a, b) => b.list.length - a.list.length)
      .slice(0, 40);
  }, [rows]);

  const availableProjects = clientFilter === "all"
    ? projects
    : projects.filter((p) => p.clientId === clientFilter);

  return (
    <AppShell>
      <div className="w-full space-y-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Deployment History</h1>
            <p className="text-sm text-muted-foreground">
              Where every worker has been deployed — with duration, transfers and off-hire reasons.
            </p>
          </div>
          <ExportButton
            rows={rows.map((r) => ({
              "P-File No": r.emp?.employeeCode ?? "",
              Worker: r.emp?.name ?? "",
              Designation: r.emp?.trade ?? "",
              Client: r.client?.name ?? "",
              Project: r.project?.name ?? "",
              Site: r.site?.name ?? "",
              Start: r.a.startDate,
              End: r.a.endDate ?? "",
              "Duration (days)": r.days ?? "",
              Status: r.a.status,
              Remarks: r.a.remarks ?? "",
            }))}
            baseName="deployment-history"
            sheetName="History"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard title="Records" value={String(rows.length)} icon={<History className="h-5 w-5" />} variant="primary" caption="Matching deployments" compact />
          <SummaryCard title="Currently deployed" value={String(active)} icon={<HardHat className="h-5 w-5" />} variant="success" caption="Active / approved" compact />
          <SummaryCard title="Transfers" value={String(transfers)} icon={<ArrowLeftRight className="h-5 w-5" />} variant="info" caption="Moved between projects" compact />
          <SummaryCard title="Off-hired" value={String(ended)} icon={<LogOut className="h-5 w-5" />} variant="warning" caption={`Avg stay ${avgDays}d`} compact />
        </div>

        <div className="space-y-4 rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Worker, P-File, project, remarks..." value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
            </div>
            <Select value={clientFilter} onValueChange={(v) => { setClientFilter(v); setProjectFilter("all"); }}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Client" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All clients</SelectItem>
                {clients.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
              </SelectContent>
            </Select>
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Project" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All projects</SelectItem>
                {availableProjects.map((p) => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as AssignmentStatus | "all")}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                {(["Pending", "Approved", "Active", "Transferred", "Ended", "Rejected"] as AssignmentStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" aria-label="Start from" />
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" aria-label="Start until" />
          </div>

          <Tabs defaultValue="table" className="space-y-4">
            <TabsList>
              <TabsTrigger value="table">Records</TabsTrigger>
              <TabsTrigger value="timeline">Worker timeline</TabsTrigger>
            </TabsList>

            <TabsContent value="table">
              <div className="overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Worker</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Project / site</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Remarks</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="h-32 text-center">
                          <EmptyState className="border-0 bg-transparent" icon={<History className="h-5 w-5" />} title="No deployment records" description="Adjust the filters or deploy workers from the available pool." />
                        </TableCell>
                      </TableRow>
                    ) : rows.map((r) => (
                      <TableRow key={r.a.id}>
                        <TableCell>
                          <Link to="/workforce/$slug" params={{ slug: employeeSlugById(r.emp!.id) }} className="font-medium text-primary hover:underline">
                            {r.emp!.name}
                          </Link>
                          <div className="text-xs text-muted-foreground">{r.emp!.employeeCode} · {r.emp!.trade}</div>
                        </TableCell>
                        <TableCell>
                          {r.client ? (
                            <Link to="/clients/$id" params={{ id: r.client.id }} className="text-primary hover:underline">{r.client.name}</Link>
                          ) : "—"}
                        </TableCell>
                        <TableCell>
                          {r.project?.name ?? "—"}
                          <div className="text-xs text-muted-foreground">{r.site?.name ?? "—"}</div>
                        </TableCell>
                        <TableCell className="text-xs">{r.a.startDate} → {r.a.endDate ?? "ongoing"}</TableCell>
                        <TableCell>{r.days !== null ? `${r.days}d` : "—"}</TableCell>
                        <TableCell><StatusBadge variant={statusVariant(r.a.status)} label={r.a.status} dot /></TableCell>
                        <TableCell className="max-w-[240px] truncate text-xs text-muted-foreground" title={r.a.remarks ?? ""}>{r.a.remarks ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="timeline" className="space-y-4">
              {timeline.length === 0 ? (
                <EmptyState icon={<Clock className="h-5 w-5" />} title="Nothing to show" description="No deployments match these filters." />
              ) : timeline.map((w) => (
                <div key={w.id} className="rounded-lg border bg-muted/20 p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <Link to="/workforce/$slug" params={{ slug: employeeSlugById(w.id) }} className="text-sm font-semibold text-primary hover:underline">
                      {w.emp.name}
                    </Link>
                    <span className="text-xs text-muted-foreground">{w.emp.employeeCode} · {w.emp.trade} · {w.list.length} deployment{w.list.length > 1 ? "s" : ""}</span>
                  </div>
                  <ol className="relative space-y-4 border-l pl-5">
                    {w.list.map((r) => (
                      <li key={r.a.id} className="relative">
                        <span className={`absolute -left-[1.42rem] top-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-background ${r.a.status === "Active" ? "bg-primary" : r.a.status === "Transferred" ? "bg-sky-500" : "bg-muted-foreground"}`} />
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium">{r.project?.name ?? "—"}</span>
                          <StatusBadge variant={statusVariant(r.a.status)} label={r.a.status} dot />
                          <span className="text-xs text-muted-foreground">{r.days !== null ? `${r.days}d` : ""}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {r.client?.name ?? "—"} · {r.site?.name ?? "—"} · {r.a.startDate} → {r.a.endDate ?? "ongoing"}
                        </div>
                        {r.a.remarks && <div className="mt-1 text-xs italic text-muted-foreground">{r.a.remarks}</div>}
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AppShell>
  );
}
