import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  Eye,
  Building2,
  MapPin,
  Calendar,
  Users,
  HardHat,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { ExportButton } from "@/components/data-io";
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
import { getClients, getProjects, getSites, getAssignments, addProject, updateProject, addSite, updateSite, deleteProject } from "@/lib/store";
import { projectFulfilment } from "@/lib/ops";
import type { Project, Site, ProjectStatus, SiteStatus } from "@/lib/types";

const projectStatuses: ProjectStatus[] = ["Planning", "Active", "On Hold", "Completed", "Cancelled"];
const siteStatuses: SiteStatus[] = ["Active", "Inactive", "Completed"];

export const Route = createFileRoute("/_authenticated/projects")({
  validateSearch: (search: Record<string, unknown>) => ({
    new: search.new === "1" || search.new === true ? true : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Projects & Sites — BSM Workforce & Operations" },
      { name: "description", content: "Manage projects, sites, and manpower requirements." },
      { property: "og:title", content: "Projects & Sites — BSM Workforce & Operations" },
      { property: "og:description", content: "Manage projects, sites, and manpower requirements." },
    ],
  }),
  component: ProjectsPage,
});

export default function ProjectsPage() {
  const [clients, setClients] = useState(getClients());
  const [projects, setProjects] = useState(getProjects());
  const [sites, setSites] = useState(getSites());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | "all">("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(
    Route.useSearch().new === true,
  );
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [viewingProject, setViewingProject] = useState<Project | null>(null);
  const [addSiteProject, setAddSiteProject] = useState<Project | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);

  const filtered = projects.filter((p) => {
    const q = search.toLowerCase();
    const c = clients.find((x) => x.id === p.clientId);
    const matchesSearch =
      p.name.toLowerCase().includes(q) ||
      p.code.toLowerCase().includes(q) ||
      p.location.toLowerCase().includes(q) ||
      c?.name.toLowerCase().includes(q);
    return matchesSearch && (statusFilter === "all" || p.status === statusFilter);
  });

  const activeProjects = projects.filter((p) => p.status === "Active").length;
  const totalRequired = projects.reduce((s, p) => s + p.requiredWorkers, 0);
  const totalSites = sites.length;
  const assignments = getAssignments();

  function refresh() {
    setClients(getClients());
    setProjects(getProjects());
    setSites(getSites());
  }

  function handleCreateProject(formData: FormData) {
    addProject({
      clientId: formData.get("clientId") as string,
      name: formData.get("name") as string,
      location: formData.get("location") as string,
      status: formData.get("status") as ProjectStatus,
      startDate: (formData.get("startDate") as string) || undefined,
      endDate: (formData.get("endDate") as string) || undefined,
      requiredWorkers: Number(formData.get("requiredWorkers") || 0),
      projectManager: formData.get("projectManager") as string,
      safetyOfficer: formData.get("safetyOfficer") as string,
    });
    setIsCreateProjectOpen(false);
    refresh();
  }

  function handleEditProject(formData: FormData) {
    if (!editingProject) return;
    updateProject(editingProject.id, {
      clientId: formData.get("clientId") as string,
      name: formData.get("name") as string,
      location: formData.get("location") as string,
      status: formData.get("status") as ProjectStatus,
      startDate: (formData.get("startDate") as string) || undefined,
      endDate: (formData.get("endDate") as string) || undefined,
      requiredWorkers: Number(formData.get("requiredWorkers") || 0),
      projectManager: formData.get("projectManager") as string,
      safetyOfficer: formData.get("safetyOfficer") as string,
    });
    setEditingProject(null);
    refresh();
  }

  function handleAddSite(formData: FormData) {
    if (!addSiteProject) return;
    addSite({
      projectId: addSiteProject.id,
      name: formData.get("name") as string,
      location: formData.get("location") as string,
      status: formData.get("status") as SiteStatus,
      requiredWorkers: Number(formData.get("requiredWorkers") || 0),
      supervisorId: formData.get("supervisorId") as string,
    });
    setAddSiteProject(null);
    refresh();
  }

  function handleDelete() {
    if (!deleteTarget) return;
    deleteProject(deleteTarget.id);
    setDeleteTarget(null);
    refresh();
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Projects & Sites</h1>
            <p className="text-sm text-muted-foreground">Projects, locations, and manpower requirements.</p>
          </div>
          <Dialog open={isCreateProjectOpen} onOpenChange={setIsCreateProjectOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="mt-2 sm:mt-0">
                <Plus className="mr-1 h-4 w-4" />
                Add project
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
              <DialogHeader>
                <DialogTitle>New project</DialogTitle>
                <DialogDescription>Enter project details and client.</DialogDescription>
              </DialogHeader>
              <ProjectForm clients={clients} onSubmit={handleCreateProject} />
            </DialogContent>
          </Dialog>
          <div className="mt-2 flex flex-wrap gap-2 sm:mt-0">
            <ExportButton
              rows={filtered.map((p) => ({
                Code: p.code,
                Project: p.name,
                Client: clients.find((c) => c.id === p.clientId)?.name ?? "",
                Location: p.location,
                Status: p.status,
                "Start Date": p.startDate ?? "",
                "End Date": p.endDate ?? "",
                "Required Workers": p.requiredWorkers,
                "Project Manager": p.projectManager ?? "",
              }))}
              baseName="projects"
              sheetName="Projects"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard title="Total projects" value={projects.length.toString()} icon={<Building2 className="h-5 w-5" />} variant="primary" caption="All projects" />
          <SummaryCard title="Active projects" value={activeProjects.toString()} icon={<Building2 className="h-5 w-5" />} variant="success" caption="In progress" />
          <SummaryCard title="Required workers" value={totalRequired.toString()} icon={<Users className="h-5 w-5" />} variant="info" caption="Total manpower" />
          <SummaryCard title="Sites" value={totalSites.toString()} icon={<MapPin className="h-5 w-5" />} variant="warning" caption="Active locations" />
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input type="search" placeholder="Search projects..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as ProjectStatus | "all")}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                {projectStatuses.map((s) => (
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
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Project / Client</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Manpower</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center">
                      <EmptyState className="bg-transparent border-0" icon={<Building2 className="h-5 w-5" />} title="No projects found" description="Add a project to get started." />
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((p) => {
                    const isExpanded = expanded.has(p.id);
                    const projectSites = sites.filter((s) => s.projectId === p.id);
                    const client = clients.find((c) => c.id === p.clientId);
                    return (
                      <>
                        <TableRow key={p.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setViewingProject(p)}>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={(evt) => {
                                evt.stopPropagation();
                                const next = new Set(expanded);
                                if (next.has(p.id)) next.delete(p.id);
                                else next.add(p.id);
                                setExpanded(next);
                              }}
                            >
                              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </Button>
                          </TableCell>
                          <TableCell className="font-medium">{p.code}</TableCell>
                          <TableCell>
                            <div className="font-medium">{p.name}</div>
                            <div className="text-xs text-muted-foreground">{client?.name}</div>
                          </TableCell>
                          <TableCell>{p.location}</TableCell>
                          <TableCell>
                            {p.startDate ? new Date(p.startDate).toLocaleDateString() : "—"} - {p.endDate ? new Date(p.endDate).toLocaleDateString() : "—"}
                          </TableCell>
                          <TableCell>
                            {(() => {
                              const f = projectFulfilment(p, sites, assignments);
                              return (
                                <div className="min-w-24">
                                  <div className="text-sm font-medium">
                                    {f.deployed}/{f.required}
                                  </div>
                                  <div className="mt-1 h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                                    <div
                                      className={`h-full rounded-full ${f.gap > 0 ? "bg-amber-500" : "bg-emerald-500"}`}
                                      style={{ width: `${f.percent}%` }}
                                    />
                                  </div>
                                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                                    {f.gap > 0 ? `${f.gap} short` : "Fulfilled"}
                                  </div>
                                </div>
                              );
                            })()}
                          </TableCell>
                          <TableCell>
                            <StatusBadge
                              variant={p.status === "Active" ? "success" : p.status === "Planning" ? "warning" : p.status === "On Hold" ? "warning" : "ghost"}
                              label={p.status}
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
                                <DropdownMenuItem onClick={() => setViewingProject(p)}>
                                  <Eye className="mr-2 h-4 w-4" />
                                  View
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setEditingProject(p)}>
                                  <Pencil className="mr-2 h-4 w-4" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setAddSiteProject(p)}>
                                  <Plus className="mr-2 h-4 w-4" />
                                  Add site
                                </DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget(p)}>
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow key={`${p.id}-sites`}>
                            <TableCell colSpan={8} className="bg-muted/30 p-0">
                              <div className="px-6 py-3">
                                <p className="mb-2 text-sm font-medium text-muted-foreground">Sites</p>
                                {projectSites.length === 0 ? (
                                  <p className="text-sm text-muted-foreground">No sites added.</p>
                                ) : (
                                  <div className="space-y-2">
                                    {projectSites.map((s) => (
                                      <div key={s.id} className="flex items-center justify-between rounded-md border bg-card p-2">
                                        <div className="flex items-center gap-2">
                                          <MapPin className="h-4 w-4 text-muted-foreground" />
                                          <div>
                                            <p className="text-sm font-medium">{s.name}</p>
                                            <p className="text-xs text-muted-foreground">{s.location} · Required: {s.requiredWorkers}</p>
                                          </div>
                                        </div>
                                        <StatusBadge variant={s.status === "Active" ? "success" : "ghost"} label={s.status} />
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <Dialog open={!!editingProject} onOpenChange={(open) => !open && setEditingProject(null)}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Edit project</DialogTitle>
              <DialogDescription>Update project {editingProject?.code}.</DialogDescription>
            </DialogHeader>
            {editingProject && <ProjectForm clients={clients} project={editingProject} onSubmit={handleEditProject} />}
          </DialogContent>
        </Dialog>

        <Dialog open={!!addSiteProject} onOpenChange={(open) => !open && setAddSiteProject(null)}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add site to {addSiteProject?.name}</DialogTitle>
              <DialogDescription>Enter site details.</DialogDescription>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAddSite(new FormData(e.currentTarget));
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="siteName">Site name</Label>
                <Input id="siteName" name="name" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="siteLocation">Location</Label>
                <Input id="siteLocation" name="location" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="siteWorkers">Required workers</Label>
                  <Input id="siteWorkers" name="requiredWorkers" type="number" defaultValue={0} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="siteStatus">Status</Label>
                  <Select name="status" defaultValue="Active">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {siteStatuses.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="supervisorId">Supervisor ID</Label>
                <Input id="supervisorId" name="supervisorId" placeholder="u4" />
              </div>
              <DialogFooter>
                <Button type="submit">Add site</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Sheet open={!!viewingProject} onOpenChange={(open) => !open && setViewingProject(null)}>
          <SheetContent className="sm:max-w-lg overflow-y-auto">
            <SheetHeader>
              <SheetTitle>{viewingProject?.name}</SheetTitle>
              <SheetDescription>{viewingProject?.code}</SheetDescription>
            </SheetHeader>
            {viewingProject && (
              <div className="mt-6 space-y-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <DetailItem label="Client" value={clients.find((c) => c.id === viewingProject.clientId)?.name || "—"} />
                  <DetailItem label="Location" value={viewingProject.location} />
                  <DetailItem label="Start date" value={viewingProject.startDate || "—"} />
                  <DetailItem label="End date" value={viewingProject.endDate || "—"} />
                  <DetailItem label="Required workers" value={viewingProject.requiredWorkers.toString()} />
                  <DetailItem label="Project manager" value={viewingProject.projectManager || "—"} />
                  <DetailItem label="Safety officer" value={viewingProject.safetyOfficer || "—"} />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Sites</Label>
                  <div className="space-y-2">
                    {sites.filter((s) => s.projectId === viewingProject.id).length === 0 ? (
                      <p className="text-sm text-muted-foreground">No sites yet.</p>
                    ) : (
                      sites
                        .filter((s) => s.projectId === viewingProject.id)
                        .map((s) => (
                          <div key={s.id} className="flex items-center justify-between rounded-lg border p-3">
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <p className="text-sm font-medium">{s.name}</p>
                                <p className="text-xs text-muted-foreground">{s.location}</p>
                              </div>
                            </div>
                            <StatusBadge variant={s.status === "Active" ? "success" : "ghost"} label={s.status} />
                          </div>
                        ))
                    )}
                  </div>
                </div>
                <Button onClick={() => { setViewingProject(null); setEditingProject(viewingProject); }}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit project
                </Button>
              </div>
            )}
          </SheetContent>
        </Sheet>

        <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Delete project?</DialogTitle>
              <DialogDescription>
                This will permanently remove {deleteTarget?.name} ({deleteTarget?.code}). This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <Button variant="destructive" onClick={handleDelete}>Delete</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}

function ProjectForm({ clients, project, onSubmit }: { clients: ReturnType<typeof getClients>; project?: Project; onSubmit: (data: FormData) => void }) {
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
          <Label htmlFor="clientId">Client</Label>
          <Select name="clientId" defaultValue={project?.clientId || clients[0]?.id}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="name">Project name</Label>
          <Input id="name" name="name" defaultValue={project?.name} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="location">Location</Label>
          <Input id="location" name="location" defaultValue={project?.location} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select name="status" defaultValue={project?.status || "Active"}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {projectStatuses.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="startDate">Start date</Label>
          <Input id="startDate" name="startDate" type="date" defaultValue={project?.startDate} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="endDate">End date</Label>
          <Input id="endDate" name="endDate" type="date" defaultValue={project?.endDate} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="requiredWorkers">Required workers</Label>
          <Input id="requiredWorkers" name="requiredWorkers" type="number" defaultValue={project?.requiredWorkers || 0} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="projectManager">Project manager</Label>
          <Input id="projectManager" name="projectManager" defaultValue={project?.projectManager} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="safetyOfficer">Safety officer</Label>
        <Input id="safetyOfficer" name="safetyOfficer" defaultValue={project?.safetyOfficer} />
      </div>
      <DialogFooter>
        <Button type="submit">{project ? "Save changes" : "Add project"}</Button>
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
