import { useMemo, useState } from "react";
import { Building, Layers, Pencil, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  getDepartments, getDesignations, addDepartment, updateDepartment, deleteDepartment,
  addDesignation, updateDesignation, deleteDesignation, getEmployees,
} from "@/lib/store";
import type { Department, Designation } from "@/lib/types";

function EmptyRow({ colSpan, text }: { colSpan: number; text: string }) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="py-10 text-center text-sm text-muted-foreground">
        {text}
      </TableCell>
    </TableRow>
  );
}

/* ------------------------------ Departments ------------------------------ */

export function DepartmentsPanel({ companyId }: { companyId: string }) {
  const [items, setItems] = useState<Department[]>(getDepartments());
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Department | null>(null);
  const employees = getEmployees();

  const rows = useMemo(
    () => items.filter((d) => !d.companyId || d.companyId === companyId),
    [items, companyId],
  );

  const refresh = () => setItems(getDepartments());

  function readForm(fd: FormData) {
    return {
      companyId,
      code: String(fd.get("code") ?? ""),
      name: String(fd.get("name") ?? ""),
      description: String(fd.get("description") ?? "") || undefined,
      headEmployeeId: (fd.get("headEmployeeId") as string) === "none" ? undefined : (fd.get("headEmployeeId") as string) || undefined,
      status: (fd.get("status") as Department["status"]) ?? "Active",
    };
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Departments</h2>
          <p className="text-sm text-muted-foreground">Functional units under the selected company.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-1">
          <Plus className="h-4 w-4" /> Add department
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">Code</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Head</TableHead>
              <TableHead className="w-32">Headcount</TableHead>
              <TableHead className="w-28">Status</TableHead>
              <TableHead className="w-32 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <EmptyRow colSpan={6} text="No departments yet. Add your first department." />
            ) : (
              rows.map((d) => {
                const head = employees.find((e) => e.id === d.headEmployeeId);
                const count = employees.filter((e) => (e.department ?? "") === d.name).length;
                return (
                  <TableRow key={d.id}>
                    <TableCell className="font-mono text-xs font-semibold">{d.code || "—"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                          <Building className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-medium">{d.name}</p>
                          {d.description ? (
                            <p className="truncate text-xs text-muted-foreground">{d.description}</p>
                          ) : null}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{head?.name ?? "—"}</TableCell>
                    <TableCell className="text-sm">{count}</TableCell>
                    <TableCell>
                      <StatusBadge variant={d.status === "Active" ? "success" : "warning"} label={d.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" onClick={() => setEditing(d)} aria-label="Edit department">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="text-destructive" onClick={() => setDeleteTarget(d)} aria-label="Delete department">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isCreateOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              addDepartment(readForm(new FormData(e.currentTarget)));
              setCreateOpen(false);
              refresh();
            }}
          >
            <DialogHeader>
              <DialogTitle>Add department</DialogTitle>
              <DialogDescription>Create a functional unit for this company.</DialogDescription>
            </DialogHeader>
            <DepartmentFields employees={employees} />
            <DialogFooter><Button type="submit">Create</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (editing) updateDepartment(editing.id, readForm(new FormData(e.currentTarget)));
              setEditing(null);
              refresh();
            }}
          >
            <DialogHeader>
              <DialogTitle>Edit department</DialogTitle>
              <DialogDescription>Update department details.</DialogDescription>
            </DialogHeader>
            <DepartmentFields department={editing ?? undefined} employees={employees} />
            <DialogFooter><Button type="submit">Save changes</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete department</DialogTitle>
            <DialogDescription>
              {deleteTarget?.name} will be removed. Linked designations stay but lose the department link.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteTarget) deleteDepartment(deleteTarget.id);
                setDeleteTarget(null);
                refresh();
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DepartmentFields({
  department,
  employees,
}: {
  department?: Department;
  employees: ReturnType<typeof getEmployees>;
}) {
  return (
    <div className="grid gap-3 py-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="code">Code</Label>
        <Input id="code" name="code" maxLength={8} defaultValue={department?.code} placeholder="OPS" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="name">Department name</Label>
        <Input id="name" name="name" required defaultValue={department?.name} placeholder="Operations" />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" rows={2} defaultValue={department?.description} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="headEmployeeId">Department head</Label>
        <Select name="headEmployeeId" defaultValue={department?.headEmployeeId ?? "none"}>
          <SelectTrigger id="headEmployeeId"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Not assigned</SelectItem>
            {employees.slice(0, 200).map((e) => (
              <SelectItem key={e.id} value={e.id}>{e.name} ({e.employeeCode})</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="status">Status</Label>
        <Select name="status" defaultValue={department?.status ?? "Active"}>
          <SelectTrigger id="status"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Active">Active</SelectItem>
            <SelectItem value="Inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

/* ------------------------------ Designations ------------------------------ */

export function DesignationsPanel({ companyId }: { companyId: string }) {
  const [items, setItems] = useState<Designation[]>(getDesignations());
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Designation | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Designation | null>(null);
  const departments = getDepartments().filter((d) => !d.companyId || d.companyId === companyId);
  const employees = getEmployees();

  const rows = useMemo(
    () => items.filter((d) => !d.companyId || d.companyId === companyId),
    [items, companyId],
  );

  const refresh = () => setItems(getDesignations());

  function readForm(fd: FormData) {
    const dept = fd.get("departmentId") as string;
    return {
      companyId,
      departmentId: !dept || dept === "none" ? undefined : dept,
      code: String(fd.get("code") ?? ""),
      title: String(fd.get("title") ?? ""),
      level: String(fd.get("level") ?? "") || undefined,
      description: String(fd.get("description") ?? "") || undefined,
      status: (fd.get("status") as Designation["status"]) ?? "Active",
    };
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Designations</h2>
          <p className="text-sm text-muted-foreground">Job titles mapped to departments.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-1">
          <Plus className="h-4 w-4" /> Add designation
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">Code</TableHead>
              <TableHead>Designation</TableHead>
              <TableHead>Department</TableHead>
              <TableHead className="w-32">Level</TableHead>
              <TableHead className="w-32">Employees</TableHead>
              <TableHead className="w-28">Status</TableHead>
              <TableHead className="w-32 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <EmptyRow colSpan={7} text="No designations yet. Add your first job title." />
            ) : (
              rows.map((g) => {
                const dept = departments.find((d) => d.id === g.departmentId);
                const count = employees.filter(
                  (e) => (e.jobTitle ?? e.trade ?? "").toLowerCase() === g.title.toLowerCase(),
                ).length;
                return (
                  <TableRow key={g.id}>
                    <TableCell className="font-mono text-xs font-semibold">{g.code || "—"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-info/10 text-info">
                          <Layers className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-medium">{g.title}</p>
                          {g.description ? (
                            <p className="truncate text-xs text-muted-foreground">{g.description}</p>
                          ) : null}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{dept?.name ?? "—"}</TableCell>
                    <TableCell className="text-sm">{g.level ?? "—"}</TableCell>
                    <TableCell className="text-sm">{count}</TableCell>
                    <TableCell>
                      <StatusBadge variant={g.status === "Active" ? "success" : "warning"} label={g.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" onClick={() => setEditing(g)} aria-label="Edit designation">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="text-destructive" onClick={() => setDeleteTarget(g)} aria-label="Delete designation">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isCreateOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              addDesignation(readForm(new FormData(e.currentTarget)));
              setCreateOpen(false);
              refresh();
            }}
          >
            <DialogHeader>
              <DialogTitle>Add designation</DialogTitle>
              <DialogDescription>Create a job title for this company.</DialogDescription>
            </DialogHeader>
            <DesignationFields departments={departments} />
            <DialogFooter><Button type="submit">Create</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (editing) updateDesignation(editing.id, readForm(new FormData(e.currentTarget)));
              setEditing(null);
              refresh();
            }}
          >
            <DialogHeader>
              <DialogTitle>Edit designation</DialogTitle>
              <DialogDescription>Update job title details.</DialogDescription>
            </DialogHeader>
            <DesignationFields designation={editing ?? undefined} departments={departments} />
            <DialogFooter><Button type="submit">Save changes</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete designation</DialogTitle>
            <DialogDescription>{deleteTarget?.title} will be removed.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteTarget) deleteDesignation(deleteTarget.id);
                setDeleteTarget(null);
                refresh();
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DesignationFields({
  designation,
  departments,
}: {
  designation?: Designation;
  departments: Department[];
}) {
  return (
    <div className="grid gap-3 py-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="code">Code</Label>
        <Input id="code" name="code" maxLength={8} defaultValue={designation?.code} placeholder="SUP" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="title">Job title</Label>
        <Input id="title" name="title" required defaultValue={designation?.title} placeholder="Site Supervisor" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="departmentId">Department</Label>
        <Select name="departmentId" defaultValue={designation?.departmentId ?? "none"}>
          <SelectTrigger id="departmentId"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Unassigned</SelectItem>
            {departments.map((d) => (
              <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="level">Level / grade</Label>
        <Select name="level" defaultValue={designation?.level ?? "Worker"}>
          <SelectTrigger id="level"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Worker">Worker</SelectItem>
            <SelectItem value="Skilled">Skilled</SelectItem>
            <SelectItem value="Supervisor">Supervisor</SelectItem>
            <SelectItem value="Executive">Executive</SelectItem>
            <SelectItem value="Manager">Manager</SelectItem>
            <SelectItem value="Director">Director</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" rows={2} defaultValue={designation?.description} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="status">Status</Label>
        <Select name="status" defaultValue={designation?.status ?? "Active"}>
          <SelectTrigger id="status"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Active">Active</SelectItem>
            <SelectItem value="Inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
