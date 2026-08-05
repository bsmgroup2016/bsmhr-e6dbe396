import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Plus, Search, HardHat, Users, ArrowRightLeft, Clock, MoreHorizontal, Pencil, Eye,
  Download, CheckCircle2, XCircle, LogOut, AlertTriangle, Layers,
  FileText, TrendingUp, DollarSign,
} from "lucide-react";
import { toast } from "sonner";
import { checkDeploymentCompliance } from "@/lib/compliance";
import { AppShell } from "@/components/app-shell";
import { SummaryCard } from "@/components/ui/summary-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DeploymentFillRates } from "@/components/deployment-fill-rates";
import { BulkDeploySheet } from "@/components/bulk-deploy-sheet";
import {
  getEmployees, getProjects, getSites, getAssignments, getUsers, addAssignment,
  updateAssignment, updateEmployee, addApproval, getCurrentCompany, getManpowerRequests,
} from "@/lib/store";
import { activeAssignedEmployeeIds, isEmployeeAvailable, hasExpiredWorkPermit } from "@/lib/availability";
import { exportRows } from "@/lib/xlsx";
import type { Assignment, AssignmentStatus } from "@/lib/types";

const statuses: AssignmentStatus[] = ["Pending", "Approved", "Active", "Ended", "Transferred", "Rejected"];
const isLive = (a: Assignment) => a.status === "Active" || a.status === "Approved";
const today = () => new Date().toISOString().slice(0, 10);

export const Route = createFileRoute("/_authenticated/operations")({
  validateSearch: (search: Record<string, unknown>) => ({
    new: search.new === "1" || search.new === true ? true : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Manpower Deployment — BSM Workforce & Operations" },
      { name: "description", content: "Deploy, transfer and release site workers across Singapore projects with approval workflow and manpower gap tracking." },
      { property: "og:title", content: "Manpower Deployment — BSM Workforce & Operations" },
      { property: "og:description", content: "Deploy, transfer and release site workers across Singapore projects with approval workflow and manpower gap tracking." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OperationsPage,
});

export default function OperationsPage() {
  const companyId = getCurrentCompany();
  const [assignments, setAssignments] = useState(getAssignments());
  const [employees, setEmployees] = useState(getEmployees());
  const [projects] = useState(getProjects());
  const [sites] = useState(getSites());
  const [users] = useState(getUsers());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<AssignmentStatus | "all">("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [siteFilter, setSiteFilter] = useState("all");
  const [tab, setTab] = useState("overview");
  const [isCreateOpen, setIsCreateOpen] = useState(Route.useSearch().new === true);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [viewing, setViewing] = useState<Assignment | null>(null);
  const [editStatus, setEditStatus] = useState<Assignment | null>(null);
  const [transferring, setTransferring] = useState<Assignment | null>(null);
  const [transferSite, setTransferSite] = useState("");

  const companyEmployees = useMemo(
    () => employees.filter((e) => !companyId || !e.companyId || e.companyId === companyId),
    [employees, companyId],
  );
  const employeeIds = useMemo(() => new Set(companyEmployees.map((e) => e.id)), [companyEmployees]);
  const scoped = useMemo(
    () => assignments.filter((a) => employeeIds.has(a.employeeId)),
    [assignments, employeeIds],
  );

  const emp = (id: string) => employees.find((e) => e.id === id);
  const site = (id?: string) => sites.find((s) => s.id === id);
  const project = (id?: string) => projects.find((p) => p.id === id);

  const assignedIds = useMemo(() => activeAssignedEmployeeIds(assignments), [assignments]);
  const pool = useMemo(
    () =>
      companyEmployees.filter(
        (e) => e.workerCategory !== "Office Staff" && isEmployeeAvailable(e, assignedIds),
      ),
    [companyEmployees, assignedIds],
  );

  const q = search.trim().toLowerCase();
  const filtered = scoped.filter((a) => {
    const e = emp(a.employeeId);
    const matchQ =
      !q ||
      e?.name.toLowerCase().includes(q) ||
      e?.employeeCode.toLowerCase().includes(q) ||
      (e?.trade ?? "").toLowerCase().includes(q) ||
      (site(a.siteId)?.name ?? "").toLowerCase().includes(q) ||
      (project(a.projectId)?.name ?? "").toLowerCase().includes(q);
    return (
      matchQ &&
      (statusFilter === "all" || a.status === statusFilter) &&
      (projectFilter === "all" || a.projectId === projectFilter) &&
      (siteFilter === "all" || a.siteId === siteFilter)
    );
  });

  const activeCount = scoped.filter((a) => a.status === "Active").length;
  const pendingCount = scoped.filter((a) => a.status === "Pending").length;
  const totalDeployed = scoped.filter(isLive).length;
  const requiredTotal = projects.reduce((s, p) => s + (p.requiredWorkers || 0), 0);
  const gap = Math.max(0, requiredTotal - totalDeployed);
  const expiringOnSite = scoped.filter((a) => {
    if (!isLive(a)) return false;
    const e = emp(a.employeeId);
    if (!e?.workPermitExpiryDate) return false;
    const left = Math.ceil((new Date(`${e.workPermitExpiryDate}T23:59:59+08:00`).getTime() - Date.now()) / 86_400_000);
    return left <= 30;
  });

  function refresh() {
    setAssignments(getAssignments());
    setEmployees(getEmployees());
  }

  async function createAssignments(ids: string[], projectId: string, siteId: string, startDate: string, remarks?: string) {
    let created = 0;
    for (const id of ids) {
      const worker = emp(id);
      if (!worker) continue;
      
      const compliance = await checkDeploymentCompliance(id);
      
      if (hasExpiredWorkPermit(worker)) {
        toast.error(`${worker.name}: Work Permit expired — deployment blocked`);
        continue;
      }

      if (!compliance.compliant) {
        toast.error(`${worker.name}: Missing/Expired safety course: ${compliance.missingOrExpired?.join(", ") || "Safety Course Required"}`);
        continue;
      }

      addAssignment({ employeeId: id, siteId, projectId, startDate, status: "Pending", remarks });
      created += 1;
    }
    if (created > 0) {
      addApproval({
        type: "Assignment",
        title: `Deploy ${created} worker(s) to ${site(siteId)?.name ?? "site"}`,
        requestedBy: "current-user",
        requestedByName: "Admin User",
        requestedAt: new Date().toISOString(),
        status: "Pending",
        payload: `Project: ${project(projectId)?.name}\nSite: ${site(siteId)?.name}\nWorkers: ${created}\nStart: ${startDate}`,
      });
      toast.success(`${created} deployment request(s) created`);
    }
    refresh();
  }

  function setStatus(a: Assignment, newStatus: AssignmentStatus) {
    updateAssignment(a.id, {
      status: newStatus,
      ...(newStatus === "Approved" || newStatus === "Active"
        ? { approvedBy: "current-user", approvedAt: new Date().toISOString() }
        : {}),
      ...(newStatus === "Ended" || newStatus === "Transferred" ? { endDate: today() } : {}),
    });
    const worker = emp(a.employeeId);
    if (worker) {
      if (newStatus === "Active" || newStatus === "Approved") {
        updateEmployee(worker.id, { deploymentStatus: "Deployed", site: site(a.siteId)?.name ?? worker.site });
      } else if (newStatus === "Ended" || newStatus === "Rejected") {
        updateEmployee(worker.id, { deploymentStatus: "Available", site: null });
      }
    }
    refresh();
    toast.success(`Assignment ${newStatus.toLowerCase()}`);
  }

  function doTransfer() {
    if (!transferring || !transferSite) return toast.error("Select a destination site");
    const target = site(transferSite);
    updateAssignment(transferring.id, { status: "Transferred", endDate: today() });
    addAssignment({
      employeeId: transferring.employeeId,
      siteId: transferSite,
      projectId: target?.projectId ?? transferring.projectId,
      startDate: today(),
      status: "Active",
      remarks: `Transferred from ${site(transferring.siteId)?.name ?? "previous site"}`,
    });
    updateEmployee(transferring.employeeId, { deploymentStatus: "Deployed", site: target?.name ?? null });
    setTransferring(null);
    setTransferSite("");
    refresh();
    toast.success("Worker transferred");
  }

  function handleExport() {
    void exportRows(
      filtered.map((a) => {
        const e = emp(a.employeeId);
        return {
          "P-File Number": e?.employeeCode ?? "",
          Worker: e?.name ?? "",
          Designation: e?.trade ?? "",
          "Pass type": e?.passType ?? "",
          Project: project(a.projectId)?.name ?? "",
          Site: site(a.siteId)?.name ?? "",
          "Start date": a.startDate,
          "End date": a.endDate ?? "",
          Status: a.status,
          Remarks: a.remarks ?? "",
        };
      }),
      "manpower-deployment", "Deployments",
    );
  }

  const filterSites = projectFilter === "all" ? sites : sites.filter((s) => s.projectId === projectFilter);

  return (
    <AppShell>
      <div className="w-full space-y-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Manpower Deployment</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Deploy available workers to projects and sites, approve requests, transfer between sites and release workers back to the available pool.
            </p>
          </div>
          <div className="mt-2 flex flex-wrap gap-2 sm:mt-0">
            <Button size="sm" variant="outline" onClick={handleExport} disabled={filtered.length === 0}>
              <Download className="mr-1 h-4 w-4" /> Export
            </Button>
            <Button size="sm" variant="outline" onClick={() => setBulkOpen(true)}>
              <Layers className="mr-1 h-4 w-4" /> Bulk deploy
            </Button>
            <Button size="sm" onClick={() => setIsCreateOpen(true)}>
              <Plus className="mr-1 h-4 w-4" /> New assignment
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard title="Deployed on site" value={totalDeployed.toString()} icon={<HardHat className="h-5 w-5" />} variant="success" caption={`${activeCount} active`} />
          <SummaryCard title="Available pool" value={pool.length.toString()} icon={<Users className="h-5 w-5" />} variant="info" caption="Ready to deploy" />
          <SummaryCard title="Pending approval" value={pendingCount.toString()} icon={<Clock className="h-5 w-5" />} variant="warning" caption="Awaiting sign-off" />
          <SummaryCard title="Manpower shortfall" value={gap.toString()} icon={<AlertTriangle className="h-5 w-5" />} variant={gap > 0 ? "warning" : "primary"} caption={`Required ${requiredTotal}`} />
        </div>

        {expiringOnSite.length > 0 && (
          <div className="rounded-xl border border-warning/40 bg-warning/5 p-4">
            <h2 className="flex items-center gap-2 text-sm font-medium">
              <AlertTriangle className="h-4 w-4 text-warning" /> Work Permit expiring within 30 days ({expiringOnSite.length} deployed workers)
            </h2>
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
              {expiringOnSite.slice(0, 6).map((a) => (
                <li key={a.id} className="flex items-center justify-between rounded-md border bg-card px-3 py-2 text-sm">
                  <span className="truncate">{emp(a.employeeId)?.name} · {site(a.siteId)?.name}</span>
                  <StatusBadge variant="warning" label={emp(a.employeeId)?.workPermitExpiryDate ?? "—"} dot />
                </li>
              ))}
            </ul>
          </div>
        )}

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="requests">Manpower Requests</TabsTrigger>
            <TabsTrigger value="assignments">Assignments</TabsTrigger>
            <TabsTrigger value="available">Available Workers</TabsTrigger>
            <TabsTrigger value="deployed">Deployed Workers</TabsTrigger>
            <TabsTrigger value="history">Deployment History</TabsTrigger>
            <TabsTrigger value="profitability">Project Profitability</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            <DeploymentFillRates
              projects={projects}
              sites={sites}
              assignments={scoped}
              onSelectProject={(id) => { setProjectFilter(id); setSiteFilter("all"); setTab("assignments"); }}
            />
          </TabsContent>

          <TabsContent value="requests" className="mt-4">
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Client Manpower Requests</h3>
                <Button size="sm">
                  <Plus className="mr-1 h-4 w-4" /> Create Request
                </Button>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">Track demand from clients for specific designations and dates.</p>
              
              <div className="mt-4 overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client / Project</TableHead>
                      <TableHead>Request Title</TableHead>
                      <TableHead>Demanded Trades</TableHead>
                      <TableHead>Start Date</TableHead>
                      <TableHead>Fill Rate</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getManpowerRequests().length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                          No active manpower requests found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      getManpowerRequests().map(req => (
                        <TableRow key={req.id}>
                          <TableCell className="font-medium">
                            {projects.find(p => p.id === req.projectId)?.name || "Multiple Projects"}
                          </TableCell>
                          <TableCell>{req.title}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {req.items.map((it, idx) => (
                                <StatusBadge key={idx} variant="info" label={`${it.count}x ${it.designation}`} />
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>{req.startDate}</TableCell>
                          <TableCell>
                            {Math.round((req.items.reduce((s, i) => s + i.countFilled, 0) / req.items.reduce((s, i) => s + i.count, 1)) * 100)}%
                          </TableCell>
                          <TableCell>
                            <StatusBadge variant={req.status === "Filled" ? "success" : "warning"} label={req.status} dot />
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="profitability" className="mt-4">
            <div className="grid gap-6 md:grid-cols-2">
              {projects.filter(p => p.status === "Active").map(p => {
                const activeOnProject = scoped.filter(a => a.projectId === p.id && isLive(a));
                const dailyChargeOut = activeOnProject.reduce((sum, a) => sum + 400, 0); // Demo rate
                const dailyCost = activeOnProject.reduce((sum, a) => {
                  const e = emp(a.employeeId);
                  const basic = (e?.basicSalary || 0) / 26;
                  const levy = 400 / 30; // $400/mo levy
                  const dorm = 300 / 30; // $300/mo dorm
                  const transport = 5; // $5/day transport overhead
                  return sum + basic + levy + dorm + transport;
                }, 0);
                
                return (
                  <div key={p.id} className="rounded-xl border bg-card p-5 shadow-sm">
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="font-semibold">{p.name}</h3>
                      <StatusBadge variant="success" label="Healthy" dot />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Est. Daily Revenue</p>
                        <p className="text-xl font-bold text-success">${Math.round(dailyChargeOut)}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Est. Daily Cost</p>
                        <p className="text-xl font-bold text-destructive">${Math.round(dailyCost)}</p>
                      </div>
                    </div>
                    
                    <div className="mt-4 pt-4 border-t flex items-center justify-between">
                      <span className="text-sm font-medium">Gross Margin</span>
                      <span className="text-lg font-bold text-primary">
                        {Math.round(((dailyChargeOut - dailyCost) / dailyChargeOut) * 100)}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="assignments" className="mt-4">
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="relative w-full max-w-sm">
                  <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input type="search" placeholder="Search worker, P-File, site or project..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Select value={projectFilter} onValueChange={(v) => { setProjectFilter(v); setSiteFilter("all"); }}>
                    <SelectTrigger className="w-44"><SelectValue placeholder="Project" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All projects</SelectItem>
                      {projects.map((p) => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                  <Select value={siteFilter} onValueChange={setSiteFilter}>
                    <SelectTrigger className="w-40"><SelectValue placeholder="Site" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All sites</SelectItem>
                      {filterSites.map((s) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                  <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as AssignmentStatus | "all")}>
                    <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All status</SelectItem>
                      {statuses.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="mt-4 overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Worker</TableHead>
                      <TableHead>Designation</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>Site</TableHead>
                      <TableHead>Start</TableHead>
                      <TableHead>Days</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="h-32 text-center">
                          <EmptyState className="border-0 bg-transparent" icon={<HardHat className="h-5 w-5" />} title="No deployments" description="Create an assignment or use bulk deploy." />
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtered.map((a) => {
                        const e = emp(a.employeeId);
                        const days = Math.max(
                          0,
                          Math.floor(((a.endDate ? new Date(a.endDate) : new Date()).getTime() - new Date(a.startDate).getTime()) / 86_400_000),
                        );
                        return (
                          <TableRow key={a.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setViewing(a)}>
                            <TableCell>
                              <div className="font-medium">{e?.name}</div>
                              <div className="text-xs text-muted-foreground">{e?.employeeCode}</div>
                            </TableCell>
                            <TableCell className="text-sm">{e?.trade || "—"}</TableCell>
                            <TableCell className="text-sm">{project(a.projectId)?.name || "—"}</TableCell>
                            <TableCell className="text-sm">{site(a.siteId)?.name || "—"}</TableCell>
                            <TableCell className="text-sm">{a.startDate}</TableCell>
                            <TableCell className="text-sm">{days}d</TableCell>
                            <TableCell>
                              <StatusBadge
                                variant={a.status === "Active" || a.status === "Approved" ? "success" : a.status === "Pending" ? "warning" : a.status === "Rejected" ? "destructive" : "info"}
                                label={a.status}
                                dot
                              />
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild onClick={(evt) => evt.stopPropagation()}>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" onClick={(evt) => evt.stopPropagation()}>
                                  <DropdownMenuItem onClick={() => setViewing(a)}>
                                    <Eye className="mr-2 h-4 w-4" /> View
                                  </DropdownMenuItem>
                                  {a.status === "Pending" && (
                                    <>
                                      <DropdownMenuItem onClick={() => setStatus(a, "Active")}>
                                        <CheckCircle2 className="mr-2 h-4 w-4" /> Approve & deploy
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => setStatus(a, "Rejected")}>
                                        <XCircle className="mr-2 h-4 w-4" /> Reject
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                  {isLive(a) && (
                                    <>
                                      <DropdownMenuItem onClick={() => { setTransferring(a); setTransferSite(""); }}>
                                        <ArrowRightLeft className="mr-2 h-4 w-4" /> Transfer site
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => setStatus(a, "Ended")}>
                                        <LogOut className="mr-2 h-4 w-4" /> Release to pool
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                  <DropdownMenuItem onClick={() => setEditStatus(a)}>
                                    <Pencil className="mr-2 h-4 w-4" /> Change status
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="pool" className="mt-4">
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-medium text-muted-foreground">Available workers</h2>
                  <p className="text-lg font-semibold">{pool.length} ready to deploy</p>
                </div>
                <Button size="sm" onClick={() => setBulkOpen(true)}>
                  <Layers className="mr-1 h-4 w-4" /> Deploy selected
                </Button>
              </div>
              <div className="mt-4 overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Worker</TableHead>
                      <TableHead>Designation</TableHead>
                      <TableHead>Pass</TableHead>
                      <TableHead>WP expiry</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pool.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="h-24 text-center text-sm text-muted-foreground">
                          Every worker is currently deployed.
                        </TableCell>
                      </TableRow>
                    ) : (
                      pool.slice(0, 50).map((e) => (
                        <TableRow key={e.id}>
                          <TableCell>
                            <div className="font-medium">{e.name}</div>
                            <div className="text-xs text-muted-foreground">{e.employeeCode}</div>
                          </TableCell>
                          <TableCell className="text-sm">{e.trade || "—"}</TableCell>
                          <TableCell className="text-sm">{e.passType}</TableCell>
                          <TableCell className="text-sm">{e.workPermitExpiryDate || "—"}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              {pool.length > 50 && (
                <p className="mt-2 text-xs text-muted-foreground">Showing first 50 — use bulk deploy to search the full pool.</p>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <BulkDeploySheet
          open={bulkOpen}
          onOpenChange={setBulkOpen}
          pool={pool}
          projects={projects}
          sites={sites}
          onDeploy={createAssignments}
        />

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>New assignment</DialogTitle>
              <DialogDescription>Deploy one available worker to a project site.</DialogDescription>
            </DialogHeader>
            <AssignmentForm
              employees={pool}
              sites={sites}
              projects={projects}
              onSubmit={(data) => {
                createAssignments(
                  [data.get("employeeId") as string],
                  data.get("projectId") as string,
                  data.get("siteId") as string,
                  data.get("startDate") as string,
                  (data.get("remarks") as string) || undefined,
                );
                setIsCreateOpen(false);
              }}
            />
          </DialogContent>
        </Dialog>

        <Sheet open={!!viewing} onOpenChange={(open) => !open && setViewing(null)}>
          <SheetContent className="overflow-y-auto sm:max-w-lg">
            <SheetHeader>
              <SheetTitle>Deployment details</SheetTitle>
              <SheetDescription>{emp(viewing?.employeeId ?? "")?.employeeCode ?? viewing?.id}</SheetDescription>
            </SheetHeader>
            {viewing && (
              <div className="mt-6 space-y-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <DetailItem label="Worker" value={emp(viewing.employeeId)?.name || "—"} />
                  <DetailItem label="Designation" value={emp(viewing.employeeId)?.trade || "—"} />
                  <DetailItem label="Project" value={project(viewing.projectId)?.name || "—"} />
                  <DetailItem label="Site" value={site(viewing.siteId)?.name || "—"} />
                  <DetailItem label="Start date" value={viewing.startDate} />
                  <DetailItem label="End date" value={viewing.endDate || "—"} />
                  <DetailItem label="Pass type" value={emp(viewing.employeeId)?.passType || "—"} />
                  <DetailItem label="WP expiry" value={emp(viewing.employeeId)?.workPermitExpiryDate || "—"} />
                  <DetailItem label="Approved by" value={viewing.approvedBy ? users.find((u) => u.id === viewing.approvedBy)?.name || "Admin User" : "—"} />
                  <DetailItem label="Status" value={viewing.status} />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Remarks</Label>
                  <p className="text-sm text-foreground">{viewing.remarks || "—"}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {viewing.status === "Pending" && (
                    <Button onClick={() => { setStatus(viewing, "Active"); setViewing(null); }}>
                      <CheckCircle2 className="mr-2 h-4 w-4" /> Approve & deploy
                    </Button>
                  )}
                  {isLive(viewing) && (
                    <>
                      <Button variant="outline" onClick={() => { setTransferring(viewing); setViewing(null); }}>
                        <ArrowRightLeft className="mr-2 h-4 w-4" /> Transfer
                      </Button>
                      <Button variant="outline" onClick={() => { setStatus(viewing, "Ended"); setViewing(null); }}>
                        <LogOut className="mr-2 h-4 w-4" /> Release
                      </Button>
                    </>
                  )}
                  <Button variant="ghost" onClick={() => { setEditStatus(viewing); setViewing(null); }}>
                    <Pencil className="mr-2 h-4 w-4" /> Change status
                  </Button>
                </div>
              </div>
            )}
          </SheetContent>
        </Sheet>

        <Dialog open={!!transferring} onOpenChange={(open) => !open && setTransferring(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Transfer worker</DialogTitle>
              <DialogDescription>
                Move {emp(transferring?.employeeId ?? "")?.name} from {site(transferring?.siteId)?.name || "current site"} to another site. The current deployment is closed today.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-2">
              <Label>Destination site</Label>
              <Select value={transferSite} onValueChange={setTransferSite}>
                <SelectTrigger><SelectValue placeholder="Select site" /></SelectTrigger>
                <SelectContent>
                  {sites.filter((s) => s.id !== transferring?.siteId).map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name} — {project(s.projectId)?.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setTransferring(null)}>Cancel</Button>
              <Button onClick={doTransfer}>Transfer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!editStatus} onOpenChange={(open) => !open && setEditStatus(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Change status</DialogTitle>
              <DialogDescription>Update deployment status for {emp(editStatus?.employeeId ?? "")?.name}.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-2 py-4">
              {statuses.map((s) => (
                <Button key={s} variant="outline" onClick={() => { if (editStatus) setStatus(editStatus, s); setEditStatus(null); }}>
                  {s}
                </Button>
              ))}
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setEditStatus(null)}>Cancel</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}

function AssignmentForm({
  employees, sites, projects, onSubmit,
}: {
  employees: ReturnType<typeof getEmployees>;
  sites: ReturnType<typeof getSites>;
  projects: ReturnType<typeof getProjects>;
  onSubmit: (data: FormData) => void;
}) {
  const [projectId, setProjectId] = useState(projects[0]?.id);
  const filteredSites = sites.filter((s) => s.projectId === projectId);

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSubmit(new FormData(e.currentTarget)); }}
      className="space-y-4"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="employeeId">Worker (available only)</Label>
          <Select name="employeeId" defaultValue={employees[0]?.id}>
            <SelectTrigger><SelectValue placeholder="Select worker" /></SelectTrigger>
            <SelectContent>
              {employees.map((e) => (
                <SelectItem key={e.id} value={e.id}>{e.name} ({e.employeeCode})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="projectId">Project</Label>
          <Select name="projectId" value={projectId} onValueChange={setProjectId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {projects.map((p) => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="siteId">Site</Label>
          <Select name="siteId" defaultValue={filteredSites[0]?.id}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {filteredSites.map((s) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="startDate">Start date</Label>
          <Input id="startDate" name="startDate" type="date" defaultValue={new Date().toISOString().split("T")[0]} required />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="remarks">Remarks</Label>
        <Input id="remarks" name="remarks" placeholder="Optional" />
      </div>
      <DialogFooter>
        <Button type="submit">Create assignment</Button>
      </DialogFooter>
    </form>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Label className="text-muted-foreground">{label}</Label>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}
