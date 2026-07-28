import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Pencil,
  Trash2,
  Eye,
  Users,
  AlertTriangle,
  Clock,
  HardHat,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { SummaryCard } from "@/components/ui/summary-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { getEmployees, addEmployee, updateEmployee, deleteEmployee } from "@/lib/store";
import type { Employee, PassType, EmployeeStatus } from "@/lib/types";

const passTypes: PassType[] = ["Work Permit", "S Pass", "Employment Pass", "Singaporean/PR"];
const statuses: EmployeeStatus[] = ["Active", "On Leave", "Deployed", "Inactive"];
const trades = ["Welder", "Pipe Fitter", "Scaffolder", "Rigger", "General Worker", "Painter", "Foreman", "Site Supervisor", "QA/QC Manager", "Project Engineer", "Safety Officer"];

export const Route = createFileRoute("/workforce")({
  head: () => ({
    meta: [
      { title: "Workforce — BSM Workforce & Operations" },
      { name: "description", content: "Manage BSM Engineering employees and worker records." },
      { property: "og:title", content: "Workforce — BSM Workforce & Operations" },
      { property: "og:description", content: "Manage BSM Engineering employees and worker records." },
    ],
  }),
  component: WorkforcePage,
});

function daysUntil(iso: string): number | null {
  if (!iso || iso === "-") return null;
  const today = new Date("2026-07-28T00:00:00+08:00");
  const target = new Date(`${iso}T00:00:00+08:00`);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

function expiryBadge(passExpiry: string) {
  const days = daysUntil(passExpiry);
  if (days === null) return null;
  if (days < 0) return <StatusBadge variant="destructive" label="Expired" dot />;
  if (days <= 60) return <StatusBadge variant="warning" label={`${days}d left`} dot />;
  return <StatusBadge variant="success" label={`${days}d left`} dot />;
}

export default function WorkforcePage() {
  const [employees, setEmployees] = useState<Employee[]>(getEmployees());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<EmployeeStatus | "all">("all");
  const [passFilter, setPassFilter] = useState<PassType | "all">("all");
  const [siteFilter, setSiteFilter] = useState<string | "all">("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [viewingEmployee, setViewingEmployee] = useState<Employee | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);

  const sites = Array.from(new Set(employees.map((e) => e.site).filter(Boolean)));

  const filtered = employees.filter((e) => {
    const q = search.toLowerCase();
    const matchesSearch =
      e.name.toLowerCase().includes(q) ||
      e.employeeCode.toLowerCase().includes(q) ||
      e.fin.toLowerCase().includes(q) ||
      e.trade.toLowerCase().includes(q);
    return (
      matchesSearch &&
      (statusFilter === "all" || e.status === statusFilter) &&
      (passFilter === "all" || e.passType === passFilter) &&
      (siteFilter === "all" || e.site === siteFilter)
    );
  });

  const activeCount = employees.filter((e) => e.status === "Active" || e.status === "Deployed").length;
  const deployedCount = employees.filter((e) => e.status === "Deployed").length;
  const expiringCount = employees.filter((e) => {
    const days = daysUntil(e.passExpiry);
    return days !== null && days <= 60 && days >= 0;
  }).length;
  const expiredCount = employees.filter((e) => {
    const days = daysUntil(e.passExpiry);
    return days !== null && days < 0;
  }).length;

  function refresh() {
    setEmployees(initialEmployees);
  }

  function handleCreate(formData: FormData) {
    const employee = {
      name: formData.get("name") as string,
      nationality: formData.get("nationality") as string,
      fin: formData.get("fin") as string,
      passType: formData.get("passType") as PassType,
      passExpiry: formData.get("passExpiry") as string,
      trade: formData.get("trade") as string,
      site: formData.get("site") as string | null,
      status: formData.get("status") as EmployeeStatus,
      basicSalary: Number(formData.get("basicSalary")),
      joinedOn: formData.get("joinedOn") as string,
      phone: formData.get("phone") as string,
      email: formData.get("email") as string,
      address: formData.get("address") as string,
      emergencyContact: formData.get("emergencyContact") as string,
      emergencyPhone: formData.get("emergencyPhone") as string,
      levyRate: Number(formData.get("levyRate") || 0),
      branch: formData.get("branch") as string,
      remarks: formData.get("remarks") as string,
    };
    addEmployee(employee);
    setIsCreateOpen(false);
    refresh();
  }

  function handleEdit(formData: FormData) {
    if (!editingEmployee) return;
    const updates = {
      name: formData.get("name") as string,
      nationality: formData.get("nationality") as string,
      fin: formData.get("fin") as string,
      passType: formData.get("passType") as PassType,
      passExpiry: formData.get("passExpiry") as string,
      trade: formData.get("trade") as string,
      site: formData.get("site") as string | null,
      status: formData.get("status") as EmployeeStatus,
      basicSalary: Number(formData.get("basicSalary")),
      joinedOn: formData.get("joinedOn") as string,
      phone: formData.get("phone") as string,
      email: formData.get("email") as string,
      address: formData.get("address") as string,
      emergencyContact: formData.get("emergencyContact") as string,
      emergencyPhone: formData.get("emergencyPhone") as string,
      levyRate: Number(formData.get("levyRate") || 0),
      branch: formData.get("branch") as string,
      remarks: formData.get("remarks") as string,
    };
    updateEmployee(editingEmployee.id, updates);
    setEditingEmployee(null);
    refresh();
  }

  function handleDelete() {
    if (!deleteTarget) return;
    deleteEmployee(deleteTarget.id);
    setDeleteTarget(null);
    refresh();
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Workforce</h1>
            <p className="text-sm text-muted-foreground">Employee directory and worker management.</p>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="mt-2 sm:mt-0">
                <Plus className="mr-1 h-4 w-4" />
                Register employee
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
              <DialogHeader>
                <DialogTitle>Register new employee</DialogTitle>
                <DialogDescription>Enter worker details. A unique employee code will be generated automatically.</DialogDescription>
              </DialogHeader>
              <EmployeeForm onSubmit={handleCreate} />
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard title="Total employees" value={employees.length.toString()} icon={<Users className="h-5 w-5" />} variant="primary" caption="All workers" />
          <SummaryCard title="Active / Deployed" value={activeCount.toString()} icon={<HardHat className="h-5 w-5" />} variant="success" caption="Available or deployed" />
          <SummaryCard title="Expiring passes" value={expiringCount.toString()} icon={<Clock className="h-5 w-5" />} variant="warning" caption="Within 60 days" />
          <SummaryCard title="Expired passes" value={expiredCount.toString()} icon={<AlertTriangle className="h-5 w-5" />} variant="destructive" caption="Immediate action" />
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search by name, code, FIN, trade..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as EmployeeStatus | "all")}>
                <SelectTrigger className="w-32">
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
              <Select value={passFilter} onValueChange={(v) => setPassFilter(v as PassType | "all")}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Pass type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All passes</SelectItem>
                  {passTypes.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={siteFilter} onValueChange={(v) => setSiteFilter(v)}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Site" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sites</SelectItem>
                  <SelectItem value={null as unknown as string}>Unassigned</SelectItem>
                  {sites.map((s) => (
                    <SelectItem key={s} value={s as string}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Nationality</TableHead>
                  <TableHead>FIN</TableHead>
                  <TableHead>Pass</TableHead>
                  <TableHead>Trade</TableHead>
                  <TableHead>Site</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Salary</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="h-32 text-center">
                      <EmptyState
                        className="bg-transparent border-0"
                        icon={<Users className="h-5 w-5" />}
                        title="No employees found"
                        description="Try adjusting filters or register a new employee."
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((e) => (
                    <TableRow key={e.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setViewingEmployee(e)}>
                      <TableCell className="font-medium">{e.employeeCode}</TableCell>
                      <TableCell>{e.name}</TableCell>
                      <TableCell>{e.nationality}</TableCell>
                      <TableCell>{e.fin}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="text-sm">{e.passType}</span>
                          {expiryBadge(e.passExpiry)}
                        </div>
                      </TableCell>
                      <TableCell>{e.trade}</TableCell>
                      <TableCell>{e.site || "—"}</TableCell>
                      <TableCell>
                        <StatusBadge
                          variant={
                            e.status === "Active" ? "success" : e.status === "Deployed" ? "info" : e.status === "On Leave" ? "warning" : "ghost"
                          }
                          label={e.status}
                          dot
                        />
                      </TableCell>
                      <TableCell className="text-right">S${e.basicSalary.toLocaleString()}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(evt) => evt.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Actions</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setViewingEmployee(e)}>
                              <Eye className="mr-2 h-4 w-4" />
                              View details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setEditingEmployee(e)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget(e)}>
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <Dialog open={!!editingEmployee} onOpenChange={(open) => !open && setEditingEmployee(null)}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Edit employee</DialogTitle>
              <DialogDescription>Update worker details for {editingEmployee?.employeeCode}.</DialogDescription>
            </DialogHeader>
            {editingEmployee && <EmployeeForm employee={editingEmployee} onSubmit={handleEdit} />}
          </DialogContent>
        </Dialog>

        <Sheet open={!!viewingEmployee} onOpenChange={(open) => !open && setViewingEmployee(null)}>
          <SheetContent className="sm:max-w-lg overflow-y-auto">
            <SheetHeader>
              <SheetTitle>{viewingEmployee?.name}</SheetTitle>
              <SheetDescription>
                {viewingEmployee?.employeeCode} • {viewingEmployee?.trade}
              </SheetDescription>
            </SheetHeader>
            {viewingEmployee && <EmployeeDetail employee={viewingEmployee} onEdit={() => { setViewingEmployee(null); setEditingEmployee(viewingEmployee); }} />}
          </SheetContent>
        </Sheet>

        <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Delete employee?</DialogTitle>
              <DialogDescription>
                This will permanently remove {deleteTarget?.name} ({deleteTarget?.employeeCode}). This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDelete}>
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}

function EmployeeForm({ employee, onSubmit }: { employee?: Employee; onSubmit: (data: FormData) => void }) {
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
          <Label htmlFor="name">Full name</Label>
          <Input id="name" name="name" defaultValue={employee?.name} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="nationality">Nationality</Label>
          <Input id="nationality" name="nationality" defaultValue={employee?.nationality} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="fin">FIN / NRIC</Label>
          <Input id="fin" name="fin" defaultValue={employee?.fin} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="passType">Pass type</Label>
          <Select name="passType" defaultValue={employee?.passType || "Work Permit"}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {passTypes.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="passExpiry">Pass expiry</Label>
          <Input id="passExpiry" name="passExpiry" type="date" defaultValue={employee?.passExpiry !== "-" ? employee?.passExpiry : ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="trade">Trade</Label>
          <Select name="trade" defaultValue={employee?.trade || trades[0]}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {trades.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select name="status" defaultValue={employee?.status || "Active"}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statuses.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="site">Site</Label>
          <Input id="site" name="site" defaultValue={employee?.site || ""} placeholder="Site name or leave blank" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="basicSalary">Basic salary (S$)</Label>
          <Input id="basicSalary" name="basicSalary" type="number" defaultValue={employee?.basicSalary || 0} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="levyRate">Levy rate (S$)</Label>
          <Input id="levyRate" name="levyRate" type="number" defaultValue={employee?.levyRate || 0} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="joinedOn">Joined on</Label>
          <Input id="joinedOn" name="joinedOn" type="date" defaultValue={employee?.joinedOn} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="branch">Branch</Label>
          <Input id="branch" name="branch" defaultValue={employee?.branch || "hq"} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" name="phone" defaultValue={employee?.phone || ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" defaultValue={employee?.email || ""} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="address">Address</Label>
        <Input id="address" name="address" defaultValue={employee?.address || ""} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="emergencyContact">Emergency contact</Label>
          <Input id="emergencyContact" name="emergencyContact" defaultValue={employee?.emergencyContact || ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="emergencyPhone">Emergency phone</Label>
          <Input id="emergencyPhone" name="emergencyPhone" defaultValue={employee?.emergencyPhone || ""} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="remarks">Remarks</Label>
        <Input id="remarks" name="remarks" defaultValue={employee?.remarks || ""} />
      </div>
      <DialogFooter>
        <Button type="submit">{employee ? "Save changes" : "Register employee"}</Button>
      </DialogFooter>
    </form>
  );
}

function EmployeeDetail({ employee, onEdit }: { employee: Employee; onEdit: () => void }) {
  const days = daysUntil(employee.passExpiry);
  return (
    <div className="mt-6 space-y-5">
      <div className="flex items-start gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xl font-semibold text-primary">
          {employee.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-foreground">{employee.name}</h3>
          <p className="text-sm text-muted-foreground">{employee.employeeCode} • {employee.trade}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <StatusBadge
              variant={
                employee.status === "Active" ? "success" : employee.status === "Deployed" ? "info" : employee.status === "On Leave" ? "warning" : "ghost"
              }
              label={employee.status}
              dot
            />
            {expiryBadge(employee.passExpiry)}
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <DetailItem label="Nationality" value={employee.nationality} />
        <DetailItem label="FIN / NRIC" value={employee.fin} />
        <DetailItem label="Pass type" value={employee.passType} />
        <DetailItem label="Pass expiry" value={employee.passExpiry} />
        <DetailItem label="Basic salary" value={`S$${employee.basicSalary.toLocaleString()}`} />
        <DetailItem label="Levy rate" value={employee.levyRate ? `S$${employee.levyRate}` : "—"} />
        <DetailItem label="Joined on" value={employee.joinedOn} />
        <DetailItem label="Site" value={employee.site || "Unassigned"} />
        <DetailItem label="Phone" value={employee.phone || "—"} />
        <DetailItem label="Email" value={employee.email || "—"} />
        <DetailItem label="Emergency contact" value={employee.emergencyContact || "—"} />
        <DetailItem label="Emergency phone" value={employee.emergencyPhone || "—"} />
      </div>

      <div className="space-y-2">
        <Label className="text-muted-foreground">Address</Label>
        <p className="text-sm text-foreground">{employee.address || "—"}</p>
      </div>

      <div className="space-y-2">
        <Label className="text-muted-foreground">Remarks</Label>
        <p className="text-sm text-foreground">{employee.remarks || "—"}</p>
      </div>

      <div className="flex gap-2">
        <Button onClick={onEdit}>
          <Pencil className="mr-2 h-4 w-4" />
          Edit
        </Button>
        <Button variant="outline" asChild>
          <Link to="/documents" search={{ employee: employee.id }}>
            View documents
          </Link>
        </Button>
      </div>
    </div>
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
