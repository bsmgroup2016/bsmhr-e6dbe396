import { useMemo, useState } from "react";
import { toast } from "sonner";
import { MapPin, Search, UserMinus, UserPlus, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StatusBadge } from "@/components/ui/status-badge";
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
import {
  addAssignment,
  getAssignments,
  getEmployees,
  getSites,
  updateAssignment,
  updateEmployee,
} from "@/lib/store";
import { activeAssignedEmployeeIds, isEmployeeAvailable } from "@/lib/availability";
import { isCountableWorker } from "@/lib/workforce-split";
import type { Employee, Project } from "@/lib/types";

const today = () => new Date().toISOString().slice(0, 10);

/**
 * One-screen crew manager for a project: assign available workers to a site
 * and take deployed workers off, with search + multi-select on both sides.
 */
export function ProjectCrewSheet({
  project,
  open,
  onOpenChange,
  onChanged,
}: {
  project: Project | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
}) {
  const [tick, setTick] = useState(0);
  const [search, setSearch] = useState("");
  const [designation, setDesignation] = useState("all");
  const [siteId, setSiteId] = useState("");
  const [startDate, setStartDate] = useState(today());
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const employees = useMemo(() => getEmployees(), [tick]);
  const assignments = useMemo(() => getAssignments(), [tick]);
  const sites = useMemo(
    () => (project ? getSites().filter((s) => s.projectId === project.id) : []),
    [project, tick],
  );

  const activeSiteId = siteId || sites.find((s) => s.status === "Active")?.id || sites[0]?.id || "";

  const crew = useMemo(() => {
    if (!project) return [];
    return assignments
      .filter(
        (a) =>
          a.projectId === project.id && (a.status === "Active" || a.status === "Approved"),
      )
      .map((a) => ({
        assignment: a,
        employee: employees.find((e) => e.id === a.employeeId),
        site: sites.find((s) => s.id === a.siteId),
      }))
      .filter((r) => r.employee);
  }, [assignments, employees, project, sites]);

  const assignedIds = useMemo(() => activeAssignedEmployeeIds(assignments), [assignments]);

  const designations = useMemo(() => {
    const set = new Set<string>();
    employees.filter(isCountableWorker).forEach((e) => e.trade && set.add(e.trade));
    return [...set].sort();
  }, [employees]);

  const available = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employees
      .filter(isCountableWorker)
      .filter((e) => isEmployeeAvailable(e, assignedIds))
      .filter((e) => designation === "all" || e.trade === designation)
      .filter(
        (e) =>
          !q ||
          e.name.toLowerCase().includes(q) ||
          (e.employeeCode ?? "").toLowerCase().includes(q),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [assignedIds, designation, employees, search]);

  function refresh() {
    setTick((t) => t + 1);
    onChanged?.();
  }

  function toggle(id: string) {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPicked(next);
  }

  function assignPicked() {
    if (!project) return;
    if (!activeSiteId) {
      toast.error("Add a site/location to this project first.");
      return;
    }
    if (picked.size === 0) {
      toast.error("Select at least one worker.");
      return;
    }
    picked.forEach((employeeId) => {
      addAssignment({
        employeeId,
        projectId: project.id,
        siteId: activeSiteId,
        startDate,
        status: "Active",
      });
      updateEmployee(employeeId, { deploymentStatus: "Deployed", status: "Deployed" });
    });
    toast.success(`${picked.size} worker(s) assigned to ${project.name}`);
    setPicked(new Set());
    refresh();
  }

  function removeOne(assignmentId: string, employee?: Employee) {
    updateAssignment(assignmentId, { status: "Ended", endDate: today() });
    toast.success(`${employee?.name ?? "Worker"} removed from project`);
    refresh();
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" /> Manage workers — {project?.name}
          </SheetTitle>
          <SheetDescription>
            {project?.code} · Required {project?.requiredWorkers ?? 0} · Deployed {crew.length}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-5 grid gap-3 rounded-lg border bg-muted/30 p-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Site / location</Label>
            <Select value={activeSiteId} onValueChange={setSiteId}>
              <SelectTrigger>
                <SelectValue placeholder="No site yet" />
              </SelectTrigger>
              <SelectContent>
                {sites.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} — {s.location}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Deployment start date</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          {/* Available pool */}
          <div className="rounded-lg border">
            <div className="flex items-center justify-between gap-2 border-b p-3">
              <p className="text-sm font-medium">Available workers ({available.length})</p>
              <Button size="sm" onClick={assignPicked} disabled={picked.size === 0}>
                <UserPlus className="mr-1 h-4 w-4" />
                Assign {picked.size > 0 ? picked.size : ""}
              </Button>
            </div>
            <div className="flex flex-col gap-2 p-3 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Name or P-File No"
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={designation} onValueChange={setDesignation}>
                <SelectTrigger className="sm:w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All designations</SelectItem>
                  {designations.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <ScrollArea className="h-80">
              <div className="space-y-1 p-3 pt-0">
                {available.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No available worker matches.
                  </p>
                ) : (
                  available.map((e) => (
                    <label
                      key={e.id}
                      className="flex cursor-pointer items-center gap-3 rounded-md border p-2 hover:bg-muted/50"
                    >
                      <Checkbox checked={picked.has(e.id)} onCheckedChange={() => toggle(e.id)} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{e.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {e.employeeCode} · {e.trade ?? "—"}
                        </p>
                      </div>
                    </label>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Current crew */}
          <div className="rounded-lg border">
            <div className="border-b p-3">
              <p className="text-sm font-medium">Deployed on this project ({crew.length})</p>
            </div>
            <ScrollArea className="h-[26rem] w-full">
              <div className="space-y-1 overflow-hidden p-3">
                {crew.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No worker deployed yet.
                  </p>
                ) : (
                  crew.map((r) => (
                    <div
                      key={r.assignment.id}
                      className="flex w-full items-center gap-2 rounded-md border p-2"
                    >
                      <div className="min-w-0 flex-1 overflow-hidden">
                        <p className="truncate text-sm font-medium">{r.employee?.name}</p>
                        <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                          {r.employee?.employeeCode} · {r.employee?.trade ?? "—"}
                          {r.site ? (
                            <>
                              {" · "}
                              <MapPin className="h-3 w-3" /> {r.site.name}
                            </>
                          ) : null}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <StatusBadge variant="success" label={r.assignment.status} />
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 shrink-0 gap-1 text-destructive hover:bg-destructive/10"
                          title="Remove from project"
                          onClick={() => removeOne(r.assignment.id, r.employee)}
                        >
                          <UserMinus className="h-4 w-4" />
                          <span className="hidden sm:inline">Remove</span>
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}