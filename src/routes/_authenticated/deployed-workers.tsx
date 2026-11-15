import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Briefcase, Users, Search, Clock, ArrowLeftRight, LogOut, History } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { SummaryCard } from "@/components/ui/summary-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DeploymentActionDialog } from "@/components/deployment-actions";
import { getEmployees, getAssignments, getCompanies, getProjects, getSites } from "@/lib/store";
import { employeeSlugById } from "@/lib/employee-slug";

export const Route = createFileRoute("/_authenticated/deployed-workers")({
  head: () => ({
    meta: [
      { title: "Deployed Workers — BSM Workforce & Operations" },
      { name: "description", content: "Workers currently assigned to projects, with site and duration." },
      { property: "og:title", content: "Deployed Workers — BSM Workforce & Operations" },
      { property: "og:description", content: "Workers currently assigned to projects, with site and duration." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DeployedWorkersPage,
});

function daysSince(iso?: string) {
  if (!iso) return null;
  const start = new Date(`${iso}T00:00:00+08:00`).getTime();
  if (Number.isNaN(start)) return null;
  return Math.max(0, Math.round((Date.now() - start) / 86_400_000));
}

function DeployedWorkersPage() {
  const [tick, setTick] = useState(0);
  const employees = getEmployees().filter((e) => !!e.companyId);
  const companies = getCompanies();
  const projects = getProjects();
  const sites = getSites();
  const assignments = getAssignments().filter((a) => a.status === "Active" || a.status === "Approved");

  const [search, setSearch] = useState("");
  const [project, setProject] = useState("all");
  const [trade, setTrade] = useState("all");
  const [company, setCompany] = useState("all");
  const [action, setAction] = useState<{ assignmentId: string; mode: "transfer" | "offhire" } | null>(null);
  void tick;

  const deployed = assignments
    .map((a) => {
      const emp = employees.find((e) => e.id === a.employeeId);
      if (!emp) return null;
      return {
        assignment: a,
        employee: emp,
        project: projects.find((p) => p.id === a.projectId),
        site: sites.find((s) => s.id === a.siteId),
        days: daysSince(a.startDate),
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  const trades = Array.from(new Set(deployed.map((r) => r.employee.trade).filter(Boolean))).sort();

  const q = search.toLowerCase();
  const rows = deployed.filter(
    (r) =>
      (r.employee.name.toLowerCase().includes(q) ||
        r.employee.employeeCode.toLowerCase().includes(q) ||
        (r.employee.passportNumber ?? "").toLowerCase().includes(q)) &&
      (project === "all" || r.assignment.projectId === project) &&
      (trade === "all" || r.employee.trade === trade) &&
      (company === "all" || r.employee.companyId === company),
  );

  const byProject = projects
    .map((p) => ({ name: p.name, count: deployed.filter((r) => r.assignment.projectId === p.id).length }))
    .filter((p) => p.count > 0)
    .sort((a, b) => b.count - a.count);

  const avgDays = deployed.length
    ? Math.round(deployed.reduce((s, r) => s + (r.days ?? 0), 0) / deployed.length)
    : 0;

  return (
    <AppShell>
      <div className="w-full space-y-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Deployed Workers</h1>
            <p className="text-sm text-muted-foreground">
              Workers assigned to a project — with site, start date and days on the job.
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/available-workers">Available workers</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/deployment-history"><History className="mr-1 h-4 w-4" /> Deployment history</Link>
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard title="Deployed workers" value={String(deployed.length)} icon={<Briefcase className="h-5 w-5" />} variant="info" caption="Assigned to projects" compact />
          <SummaryCard title="Active projects" value={String(byProject.length)} icon={<Users className="h-5 w-5" />} variant="primary" caption="With manpower" compact />
          <SummaryCard title="Avg days on job" value={String(avgDays)} icon={<Clock className="h-5 w-5" />} variant="warning" caption="Since assignment start" compact />
          <SummaryCard title="Total workforce" value={String(employees.length)} icon={<Users className="h-5 w-5" />} variant="primary" caption="All workers" compact />
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold">Deployment by project</h2>
          {byProject.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active deployments.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {byProject.map((p) => (
                <span key={p.name} className="rounded-full border bg-muted/40 px-3 py-1.5 text-xs font-medium">
                  {p.name} · {p.count}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4 rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Search deployed workers"
                placeholder="Name, P-File Number, passport..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={project} onValueChange={setProject}>
              <SelectTrigger aria-label="Project" className="w-full sm:w-48"><SelectValue placeholder="Project" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All projects</SelectItem>
                {projects.map((p) => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}
              </SelectContent>
            </Select>
            <Select value={trade} onValueChange={setTrade}>
              <SelectTrigger aria-label="Designation" className="w-full sm:w-44"><SelectValue placeholder="Designation" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All designations</SelectItem>
                {trades.map((t) => (<SelectItem key={t} value={t}>{t}</SelectItem>))}
              </SelectContent>
            </Select>
            <Select value={company} onValueChange={setCompany}>
              <SelectTrigger aria-label="Company" className="w-full sm:w-44"><SelectValue placeholder="Company" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All companies</SelectItem>
                {companies.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><span>{rows.length} of {deployed.length} deployments</span>{(search || project !== "all" || trade !== "all" || company !== "all") && <Button size="sm" variant="ghost" onClick={() => { setSearch(""); setProject("all"); setTrade("all"); setCompany("all"); }}>Clear filters</Button>}</div>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Worker</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Site</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>Days on job</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center">
                      <EmptyState className="border-0 bg-transparent" icon={<Briefcase className="h-5 w-5" />} title="No deployed workers" description="No assignments match these filters." />
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r) => (
                    <TableRow key={r.assignment.id}>
                      <TableCell>
                        <Link to="/workforce/$slug" params={{ slug: employeeSlugById(r.employee.id) }} className="font-medium text-primary hover:underline">
                          {r.employee.name}
                        </Link>
                        <div className="text-xs text-muted-foreground">
                          P-File No: {r.employee.employeeCode} · {r.employee.trade}
                        </div>
                      </TableCell>
                      <TableCell>{r.project?.name ?? "—"}</TableCell>
                      <TableCell>{r.site?.name ?? "—"}</TableCell>
                      <TableCell>{r.assignment.startDate}</TableCell>
                      <TableCell>{r.days !== null ? `${r.days}d` : "—"}</TableCell>
                      <TableCell>
                        <StatusBadge variant={r.assignment.status === "Active" ? "success" : "info"} label={r.assignment.status} dot />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setAction({ assignmentId: r.assignment.id, mode: "transfer" })}
                          >
                            <ArrowLeftRight className="mr-1 h-3.5 w-3.5" /> Transfer
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setAction({ assignmentId: r.assignment.id, mode: "offhire" })}
                          >
                            <LogOut className="mr-1 h-3.5 w-3.5" /> Off-hire
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {action && (() => {
          const row = deployed.find((r) => r.assignment.id === action.assignmentId);
          if (!row) return null;
          return (
            <DeploymentActionDialog
              open
              onOpenChange={(o) => !o && setAction(null)}
              assignment={row.assignment}
              employee={row.employee}
              projects={projects}
              sites={sites}
              mode={action.mode}
              onDone={() => setTick((t) => t + 1)}
            />
          );
        })()}
      </div>
    </AppShell>
  );
}