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
import { ProjectCrewSheet } from "@/components/project-crew-sheet";
import type { Project, Site, ProjectStatus, SiteStatus } from "@/lib/types";

const projectStatuses: ProjectStatus[] = ["Planning", "Active", "On Hold", "Completed", "Cancelled"];
const siteStatuses: SiteStatus[] = ["Active", "Inactive", "Completed"];

export const Route = createFileRoute("/_authenticated/projects")({
  validateSearch: (search: Record<string, unknown>) => ({
    new: search.new === "1" || search.new === true ? true : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Projects & Site Management | BSM Engineering" },
      { name: "description", content: "Track BSM Engineering project sites, manpower requirements, and deployment status across Singapore." },
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
  const [crewProject, setCrewProject] = useState<Project | null>(null);

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
  const [refreshKey, setRefreshKey] = useState(0);
  const assignments = getAssignments();
  void refreshKey;

  function refresh() {
    setClients(getClients());
    setProjects(getProjects());
    setSites(getSites());
    setRefreshKey((t) => t + 1);
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
      lat: formData.get("lat") ? Number(formData.get("lat")) : undefined,
      lng: formData.get("lng") ? Number(formData.get("lng")) : undefined,
      geofenceRadiusM: Number(formData.get("geofenceRadiusM") || 300),
      geofenceEnforced: formData.get("geofenceEnforced") === "on",
      selfieRequired: formData.get("selfieRequired") === "on",
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
      <div className="w-full space-y-6">
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

          {/* Mobile card list */}
          <div className="mt-4 space-y-3 lg:hidden">
            {filtered.length === 0 ? (
              <EmptyState icon={<Building2 className="h-5 w-5" />} title="No projects found" description="Add a project to get started." />
            ) : (
              filtered.map((p) => {
                const client = clients.find((c) => c.id === p.clientId);
                const f = projectFulfilment(p, sites, assignments);
                const projectSites = sites.filter((s) => s.projectId === p.id);
                return (
                  <div key={`m-${p.id}`} className="rounded-lg border bg-card p-3">
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-medium leading-tight">{p.name}</div>
                        <div className="mt-0.5 truncate text-xs text-muted-foreground">
                          {p.code} · {client?.name}
                        </div>
                        <div className="mt-0.5 truncate text-xs text-muted-foreground">{p.location}</div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <StatusBadge
                          variant={p.status === "Active" ? "success" : p.status === "Planning" ? "warning" : p.status === "On Hold" ? "warning" : "ghost"}
                          label={p.status}
                          dot
                        />
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
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
                            <DropdownMenuItem onClick={() => setCrewProject(p)}>
                              <Users className="mr-2 h-4 w-4" />
                              Manage workers
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
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div className="min-w-0">
                        <label className="text-[11px] text-muted-foreground">Start date</label>
                        <Input
                          type="date"
                          aria-label={`Start date for ${p.name}`}
                          className="mt-1 h-9 w-full text-sm"
                          value={p.startDate ?? ""}
                          onChange={(evt) => {
                            updateProject(p.id, { startDate: evt.target.value || undefined });
                            refresh();
                          }}
                        />
                      </div>
                      <div className="min-w-0">
                        <label className="text-[11px] text-muted-foreground">End date</label>
                        <Input
                          type="date"
                          aria-label={`End date for ${p.name}`}
                          className="mt-1 h-9 w-full text-sm"
                          value={p.endDate ?? ""}
                          onChange={(evt) => {
                            updateProject(p.id, { endDate: evt.target.value || undefined });
                            refresh();
                          }}
                        />
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3">
                      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setCrewProject(p)}>
                        <div className="text-xs text-muted-foreground">Manpower</div>
                        <div className="text-sm font-medium">
                          {f.deployed}/{f.required} · {f.gap > 0 ? `${f.gap} short` : "Fulfilled"}
                        </div>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div className={`h-full rounded-full ${f.gap > 0 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${f.percent}%` }} />
                        </div>
                      </button>
                      <span className="shrink-0 text-xs text-muted-foreground">{projectSites.length} sites</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="mt-4 hidden overflow-x-auto rounded-lg border lg:block">
            <Table className="min-w-[1120px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead className="w-24 whitespace-nowrap">Code</TableHead>
                  <TableHead className="min-w-[15rem]">Project / Client</TableHead>
                  <TableHead className="min-w-[11rem]">Location</TableHead>
                  <TableHead className="w-[10.5rem] whitespace-nowrap">Start date</TableHead>
                  <TableHead className="w-[10.5rem] whitespace-nowrap">End date</TableHead>
                  <TableHead className="w-32 whitespace-nowrap">Manpower</TableHead>
                  <TableHead className="w-28 whitespace-nowrap">Status</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-32 text-center">
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
                        <TableRow key={p.id} className="cursor-pointer align-middle hover:bg-muted/50" onClick={() => setViewingProject(p)}>
                          <TableCell className="align-middle">
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
                          <TableCell className="whitespace-nowrap align-middle font-medium">{p.code}</TableCell>
                          <TableCell className="align-middle">
                            <div className="font-medium leading-tight">{p.name}</div>
                            <div className="mt-0.5 text-xs text-muted-foreground">{client?.name}</div>
                          </TableCell>
                          <TableCell className="align-middle text-sm text-muted-foreground">{p.location}</TableCell>
                          <TableCell className="align-middle" onClick={(evt) => evt.stopPropagation()}>
                            <Input
                              type="date"
                              aria-label={`Start date for ${p.name}`}
                              className="h-8 w-full text-sm"
                              value={p.startDate ?? ""}
                              onChange={(evt) => {
                                updateProject(p.id, { startDate: evt.target.value || undefined });
                                refresh();
                              }}
                            />
                          </TableCell>
                          <TableCell className="align-middle" onClick={(evt) => evt.stopPropagation()}>
                            <Input
                              type="date"
                              aria-label={`End date for ${p.name}`}
                              className="h-8 w-full text-sm"
                              value={p.endDate ?? ""}
                              onChange={(evt) => {
                                updateProject(p.id, { endDate: evt.target.value || undefined });
                                refresh();
                              }}
                            />
                          </TableCell>
                          <TableCell className="align-middle">
                            {(() => {
                              const f = projectFulfilment(p, sites, assignments);
                              return (
                                <div
                                  className="cursor-pointer"
                                  title="Manage workers"
                                  onClick={(evt) => {
                                    evt.stopPropagation();
                                    setCrewProject(p);
                                  }}
                                >
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
                          <TableCell className="align-middle">
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
                                <DropdownMenuItem onClick={() => setCrewProject(p)}>
                                  <Users className="mr-2 h-4 w-4" />
                                  Manage workers
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
                            <TableCell colSpan={9} className="bg-muted/30 p-0">
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
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => { setViewingProject(null); setEditingProject(viewingProject); }}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit project
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      const p = viewingProject;
                      setViewingProject(null);
                      setCrewProject(p);
                    }}
                  >
                    <Users className="mr-2 h-4 w-4" />
                    Manage workers
                  </Button>
                </div>
              </div>
            )}
          </SheetContent>
        </Sheet>

        <ProjectCrewSheet
          project={crewProject}
          open={!!crewProject}
          onOpenChange={(open) => !open && setCrewProject(null)}
          onChanged={refresh}
        />

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
