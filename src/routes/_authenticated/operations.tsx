import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Plus,
  Search,
  HardHat,
  Users,
  ArrowRightLeft,
  CheckCircle2,
  Clock,
  MoreHorizontal,
  Pencil,
  Trash2,
  Eye,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { SummaryCard } from "@/components/ui/summary-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { getEmployees, getProjects, getSites, getAssignments, getUsers, addAssignment, updateAssignment, addApproval } from "@/lib/store";
import type { Assignment, AssignmentStatus } from "@/lib/types";

const statuses: AssignmentStatus[] = ["Pending", "Approved", "Active", "Ended", "Transferred", "Rejected"];

export const Route = createFileRoute("/_authenticated/operations")({
  validateSearch: (search: Record<string, unknown>) => ({
    new: search.new === "1" || search.new === true ? true : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Operations — BSM Workforce & Operations" },
      { name: "description", content: "Deployment and assignment management." },
      { property: "og:title", content: "Operations — BSM Workforce & Operations" },
      { property: "og:description", content: "Deployment and assignment management." },
    ],
  }),
  component: OperationsPage,
});

export default function OperationsPage() {
  const [assignments, setAssignments] = useState(getAssignments());
  const [employees] = useState(getEmployees());
  const [projects] = useState(getProjects());
  const [sites] = useState(getSites());
  const [users] = useState(getUsers());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<AssignmentStatus | "all">("all");
  const [isCreateOpen, setIsCreateOpen] = useState(Route.useSearch().new === true);
  const [viewing, setViewing] = useState<Assignment | null>(null);
  const [editStatus, setEditStatus] = useState<Assignment | null>(null);

  const filtered = assignments.filter((a) => {
    const q = search.toLowerCase();
    const emp = employees.find((e) => e.id === a.employeeId);
    const site = sites.find((s) => s.id === a.siteId);
    const project = projects.find((p) => p.id === a.projectId);
    return (
      (emp?.name.toLowerCase().includes(q) || emp?.employeeCode.toLowerCase().includes(q) || site?.name.toLowerCase().includes(q) || project?.name.toLowerCase().includes(q)) &&
      (statusFilter === "all" || a.status === statusFilter)
    );
  });

  const activeCount = assignments.filter((a) => a.status === "Active").length;
  const pendingCount = assignments.filter((a) => a.status === "Pending").length;
  const totalDeployed = assignments.filter((a) => a.status === "Active" || a.status === "Approved").length;

  function refresh() {
    setAssignments(getAssignments());
  }

  function handleCreate(formData: FormData) {
    addAssignment({
      employeeId: formData.get("employeeId") as string,
      siteId: formData.get("siteId") as string,
      projectId: formData.get("projectId") as string,
      startDate: formData.get("startDate") as string,
      status: "Pending",
      remarks: (formData.get("remarks") as string) || undefined,
    });
    addApproval({
      type: "Assignment",
      title: `Assign ${employees.find((e) => e.id === formData.get("employeeId"))?.name} to ${sites.find((s) => s.id === formData.get("siteId"))?.name}`,
      requestedBy: "current-user",
      requestedByName: "Admin User",
      requestedAt: new Date().toISOString(),
      status: "Pending",
      payload: `Employee: ${formData.get("employeeId")}\nSite: ${formData.get("siteId")}\nProject: ${formData.get("projectId")}\nStart: ${formData.get("startDate")}`,
    });
    setIsCreateOpen(false);
    refresh();
  }

  function handleStatusChange(newStatus: AssignmentStatus) {
    if (!editStatus) return;
    updateAssignment(editStatus.id, { status: newStatus });
    setEditStatus(null);
    refresh();
  }

  return (
    <AppShell>
      <div className="w-full space-y-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Operations</h1>
            <p className="text-sm text-muted-foreground">Deployment and worker assignments.</p>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="mt-2 sm:mt-0">
                <Plus className="mr-1 h-4 w-4" />
                New assignment
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
              <DialogHeader>
                <DialogTitle>New assignment</DialogTitle>
                <DialogDescription>Assign a worker to a site/project.</DialogDescription>
              </DialogHeader>
              <AssignmentForm employees={employees} sites={sites} projects={projects} onSubmit={handleCreate} />
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard title="Active assignments" value={activeCount.toString()} icon={<HardHat className="h-5 w-5" />} variant="success" caption="On site" />
          <SummaryCard title="Pending approval" value={pendingCount.toString()} icon={<Clock className="h-5 w-5" />} variant="warning" caption="Needs approval" />
          <SummaryCard title="Total deployed" value={totalDeployed.toString()} icon={<Users className="h-5 w-5" />} variant="info" caption="Active + approved" />
          <SummaryCard title="Transfers" value={assignments.filter((a) => a.status === "Transferred").length.toString()} icon={<ArrowRightLeft className="h-5 w-5" />} variant="primary" caption="All time" />
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input type="search" placeholder="Search assignments..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as AssignmentStatus | "all")}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                {statuses.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="mt-4 overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Site</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center">
                      <EmptyState className="bg-transparent border-0" icon={<HardHat className="h-5 w-5" />} title="No assignments" description="Create a new assignment." />
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((a) => {
                    const emp = employees.find((e) => e.id === a.employeeId);
                    const site = sites.find((s) => s.id === a.siteId);
                    const project = projects.find((p) => p.id === a.projectId);
                    return (
                      <TableRow key={a.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setViewing(a)}>
                        <TableCell>
                          <div className="font-medium">{emp?.name}</div>
                          <div className="text-xs text-muted-foreground">{emp?.employeeCode}</div>
                        </TableCell>
                        <TableCell>{site?.name}</TableCell>
                        <TableCell>{project?.name}</TableCell>
                        <TableCell>{a.startDate}</TableCell>
                        <TableCell>
                          <StatusBadge
                            variant={a.status === "Active" ? "success" : a.status === "Pending" ? "warning" : a.status === "Approved" ? "success" : a.status === "Rejected" ? "destructive" : "info"}
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
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setViewing(a)}>
                                <Eye className="mr-2 h-4 w-4" />
                                View
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setEditStatus(a)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Change status
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

        <Sheet open={!!viewing} onOpenChange={(open) => !open && setViewing(null)}>
          <SheetContent className="sm:max-w-lg overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Assignment details</SheetTitle>
              <SheetDescription>{viewing?.id}</SheetDescription>
            </SheetHeader>
            {viewing && (
              <div className="mt-6 space-y-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <DetailItem label="Employee" value={employees.find((e) => e.id === viewing.employeeId)?.name || "—"} />
                  <DetailItem label="Site" value={sites.find((s) => s.id === viewing.siteId)?.name || "—"} />
                  <DetailItem label="Project" value={projects.find((p) => p.id === viewing.projectId)?.name || "—"} />
                  <DetailItem label="Start date" value={viewing.startDate} />
                  <DetailItem label="End date" value={viewing.endDate || "—"} />
                  <DetailItem label="Approved by" value={viewing.approvedBy ? users.find((u) => u.id === viewing.approvedBy)?.name || viewing.approvedBy : "—"} />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Remarks</Label>
                  <p className="text-sm text-foreground">{viewing.remarks || "—"}</p>
                </div>
                <Button onClick={() => { setViewing(null); setEditStatus(viewing); }}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Change status
                </Button>
              </div>
            )}
          </SheetContent>
        </Sheet>

        <Dialog open={!!editStatus} onOpenChange={(open) => !open && setEditStatus(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Change status</DialogTitle>
              <DialogDescription>Update status for assignment of {employees.find((e) => e.id === editStatus?.employeeId)?.name}.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-2 py-4">
              {statuses.map((s) => (
                <Button key={s} variant="outline" onClick={() => handleStatusChange(s)}>
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

function AssignmentForm({ employees, sites, projects, onSubmit }: { employees: ReturnType<typeof getEmployees>; sites: ReturnType<typeof getSites>; projects: ReturnType<typeof getProjects>; onSubmit: (data: FormData) => void }) {
  const [projectId, setProjectId] = useState(projects[0]?.id);
  const filteredSites = sites.filter((s) => s.projectId === projectId);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(new FormData(e.currentTarget));
      }}
      className="space-y-4"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="employeeId">Employee</Label>
          <Select name="employeeId" defaultValue={employees[0]?.id}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {employees.filter((e) => e.status === "Active" || e.status === "On Leave").map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.name} ({e.employeeCode})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="projectId">Project</Label>
          <Select name="projectId" value={projectId} onValueChange={setProjectId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="siteId">Site</Label>
          <Select name="siteId" defaultValue={filteredSites[0]?.id}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {filteredSites.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
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
