import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Building2, BedDouble, Users, Plus, Search, Trash2, LogOut, Download, FileText, ClipboardCheck, History, Eye, MapPin, Pencil, Upload, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { SummaryCard } from "@/components/ui/summary-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  getDormitories, getAllocations, getEmployees, getCurrentCompany,
  addDormitory, updateDormitory, updateAllocation, deleteDormitory, addAllocation, checkOutAllocation, deleteAllocation, dormOccupancy,
  getDormitoryInspections, addDormitoryInspection, updateDormitoryInspection, deleteDormitoryInspection,
  getDormitoryMovements, addDormitoryMovement,
} from "@/lib/store";
import { exportRows, readSpreadsheet, downloadDemoSheet } from "@/lib/xlsx";
import { availableBeds, planBulkAllocation, type PlannedAllocation, type PlanError } from "@/features/dormitory/bulk-allocate";
import { DormitoryBilling } from "@/components/dormitory-billing";
import { HousingNotificationPanel } from "@/components/housing-notification-panel";
import { dormCapacityCheck, SQM_PER_RESIDENT } from "@/lib/mom";
import type { Dormitory, BedAllocation } from "@/lib/types";
import {
  closedAllocSession, closedDormSession, openAddAllocSession, openAddDormSession,
  openEditAllocSession, openEditDormSession, withAllocForm, withDormForm,
  type AllocForm, type AllocSession, type DormForm, type DormSession,
} from "@/core/dormitory-form-state";

export const Route = createFileRoute("/_authenticated/accommodation")({
  head: () => ({
    meta: [
      { title: "Dormitory & Beds — BSM Workforce & Operations" },
      { name: "description", content: "Manage dormitories, bed allocations, rent invoices, payments and outstanding balances." },
      { property: "og:title", content: "Dormitory & Beds — BSM Workforce & Operations" },
      { property: "og:description", content: "Manage dormitories, bed allocations, rent invoices, payments and outstanding balances." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AccommodationPage,
});

const today = () => new Date().toISOString().slice(0, 10);

export default function AccommodationPage() {
  const companyId = getCurrentCompany();
  const [dorms, setDorms] = useState(getDormitories());
  const [allocs, setAllocs] = useState(getAllocations());
  const [employees] = useState(getEmployees());
  const [search, setSearch] = useState("");
  const [dormSession, setDormSession] = useState<DormSession>(closedDormSession);
  const [allocSession, setAllocSession] = useState<AllocSession>(closedAllocSession);
  const dormOpen = dormSession.open;
  const allocOpen = allocSession.open;
  const dormForm = dormSession.form;
  const allocForm = allocSession.form;
  const editDormId = dormSession.editId;
  const editAllocId = allocSession.editId;
  const setDormForm = (form: DormForm) => setDormSession(withDormForm(dormSession, form));
  const setAllocForm = (form: AllocForm) => setAllocSession(withAllocForm(allocSession, form));
  const [dormFilter, setDormFilter] = useState("all");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkPlan, setBulkPlan] = useState<{ valid: PlannedAllocation[]; errors: PlanError[]; total: number } | null>(null);

  function refresh() {
    setDorms(getDormitories());
    setAllocs(getAllocations());
  }

  const scopedDorms = useMemo(
    () => dorms.filter((d) => !companyId || !d.companyId || d.companyId === companyId),
    [dorms, companyId],
  );
  const dormIds = new Set(scopedDorms.map((d) => d.id));
  const scopedAllocs = allocs.filter((a) => dormIds.has(a.dormitoryId));
  const companyEmployees = employees.filter((e) => !companyId || e.companyId === companyId);
  const empName = (id: string) => employees.find((e) => e.id === id)?.name ?? "—";
  const empCode = (id: string) => employees.find((e) => e.id === id)?.employeeCode ?? "";
  const dormName = (id: string) => dorms.find((d) => d.id === id)?.name ?? "—";

  const totalBeds = scopedDorms.reduce((s, d) => s + d.capacity, 0);
  const occupied = scopedAllocs.filter((a) => a.status !== "Vacated").length;
  const monthlyCost = scopedAllocs
    .filter((a) => a.status !== "Vacated")
    .reduce((s, a) => s + a.monthlyRent, 0);

  const q = search.trim().toLowerCase();
  const filteredAllocs = scopedAllocs.filter(
    (a) =>
      !q ||
      empName(a.employeeId).toLowerCase().includes(q) ||
      empCode(a.employeeId).toLowerCase().includes(q) ||
      dormName(a.dormitoryId).toLowerCase().includes(q) ||
      a.roomNo.toLowerCase().includes(q),
  ).filter((a) => dormFilter === "all" || a.dormitoryId === dormFilter);
  const availableTotal = scopedDorms.reduce((s, d) => s + availableBeds(d, allocs), 0);

  function openEditDorm(d: Dormitory) {
    setDormSession(openEditDormSession(d));
  }
  function openEditAlloc(a: BedAllocation) {
    setAllocSession(openEditAllocSession(a));
  }

  async function handleBulkFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast.error("File too large (max 5 MB)");
    try {
      const rows = await readSpreadsheet(file);
      if (rows.length > 1000) return toast.error("Maximum 1000 rows per upload");
      const plan = planBulkAllocation(rows, scopedDorms, companyEmployees, allocs, today());
      setBulkPlan({ ...plan, total: plan.valid.length + plan.errors.length });
    } catch {
      toast.error("Could not read the file. Use .xlsx or .csv");
    }
  }
  function confirmBulk() {
    if (!bulkPlan?.valid.length) return;
    for (const p of bulkPlan.valid) {
      addAllocation({ dormitoryId: p.dormitoryId, employeeId: p.employeeId, roomNo: p.roomNo, bedNo: p.bedNo || undefined, checkInDate: p.checkInDate, monthlyRent: p.monthlyRent, status: "Occupied", remarks: p.remarks || undefined });
    }
    toast.success(`${bulkPlan.valid.length} workers allocated${bulkPlan.errors.length ? `, ${bulkPlan.errors.length} rows skipped` : ""}`);
    setBulkPlan(null);
    setBulkOpen(false);
    refresh();
  }
  function downloadBulkTemplate() {
    const cols = ["P-File No", "FIN", "Dormitory", "Room", "Bed", "Check in", "Monthly rent", "Remarks"].map((l) => ({ key: l, label: l }));
    void downloadDemoSheet(cols, [{ "P-File No": companyEmployees[0]?.employeeCode ?? "B-1", FIN: "", Dormitory: scopedDorms[0]?.name ?? "Dormitory name", Room: "01-05", Bed: "A", "Check in": today(), "Monthly rent": "", Remarks: "" }], "dormitory_worker_upload", "Workers");
  }

  function saveDorm() {
    if (!dormForm.name.trim()) return toast.error("Dormitory name required");
    if (editDormId) updateDormitory(editDormId, dormForm);
    else addDormitory({ ...dormForm, companyId: companyId || undefined });
    toast.success(editDormId ? "Dormitory updated" : "Dormitory added");
    setDormSession(closedDormSession());
    refresh();
  }

  function saveAlloc() {
    if (!allocForm.dormitoryId || !allocForm.employeeId || !allocForm.roomNo.trim()) {
      return toast.error("Dormitory, worker and room number required");
    }
    const dorm = dorms.find((d) => d.id === allocForm.dormitoryId);
    if (editAllocId) {
      const prev = allocs.find((a) => a.id === editAllocId);
      if (dorm && prev && prev.dormitoryId !== dorm.id && availableBeds(dorm, allocs) <= 0) return toast.error(`${dorm.name} has no available beds`);
      updateAllocation(editAllocId, { ...allocForm, bedNo: allocForm.bedNo || undefined, checkOutDate: allocForm.status === "Vacated" ? (prev?.checkOutDate ?? today()) : undefined });
      setAllocSession(closedAllocSession());
      refresh();
      return toast.success("Allocation updated");
    }
    const check = dorm ? dormCapacityCheck(dorm, dormOccupancy(dorm.id)) : null;
    if (dorm && check && check.effective > 0 && check.occupied >= check.effective) {
      return toast.error(
        check.allowedByArea > 0 && check.effective === check.allowedByArea
          ? `${dorm.name} is at the MOM space limit (${check.effective} beds for ${dorm.floorAreaSqm} m²)`
          : `${dorm.name} is at full capacity`,
      );
    }
    addAllocation({
      ...allocForm,
      monthlyRent: allocForm.monthlyRent || dorm?.monthlyRent || 0,
    });
    setAllocSession(closedAllocSession());
    refresh();
    toast.success("Bed allocated");
  }

  function handleExport() {
    void exportRows(
      filteredAllocs.map((a) => ({
        Worker: empName(a.employeeId),
        "P-File No": empCode(a.employeeId),
        Dormitory: dormName(a.dormitoryId),
        Room: a.roomNo,
        Bed: a.bedNo ?? "",
        "Check in": a.checkInDate,
        "Check out": a.checkOutDate ?? "",
        "Monthly rent": a.monthlyRent,
        Status: a.status,
      })),
      "accommodation", "Allocations",
    );
  }

  return (
    <AppShell>
      <div className="w-full space-y-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Dormitory & Beds</h1>
            <p className="text-sm text-muted-foreground">Dormitory list, total beds, allocation and occupancy tracking.</p>
          </div>
          <div className="mt-2 flex gap-2 sm:mt-0">
            <Button size="sm" variant="outline" onClick={handleExport} disabled={filteredAllocs.length === 0}>
              <Download className="mr-1 h-4 w-4" /> Export
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <SummaryCard title="Dormitories" value={scopedDorms.length.toString()} icon={<Building2 className="h-5 w-5" />} variant="primary" caption="Registered housing" />
          <SummaryCard title="Total beds" value={totalBeds.toString()} icon={<BedDouble className="h-5 w-5" />} variant="default" caption="Licensed capacity" />
          <SummaryCard title="Available seats" value={availableTotal.toString()} icon={<BedDouble className="h-5 w-5" />} variant="success" caption="Free beds right now" />
          <SummaryCard title="Occupied" value={`${occupied}`} icon={<Users className="h-5 w-5" />} variant="success" caption={`${totalBeds ? Math.round((occupied / totalBeds) * 100) : 0}% utilisation`} />
          <SummaryCard title="Monthly rent" value={`$${monthlyCost.toLocaleString()}`} icon={<BedDouble className="h-5 w-5" />} variant="warning" caption="Active allocations" />
        </div>

        <Tabs defaultValue="allocations">
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="allocations">Current Residents</TabsTrigger>
            <TabsTrigger value="dormitories">Dormitories</TabsTrigger>
            <TabsTrigger value="history">Movement Tracking</TabsTrigger>
            <TabsTrigger value="mom-address">MOM Notification</TabsTrigger>
            <TabsTrigger value="invoices">Rent & Payments</TabsTrigger>
          </TabsList>

          <TabsContent value="allocations" className="mt-4">
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative w-full max-w-sm">
                  <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input type="search" placeholder="Search worker, dorm or room..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
                </div>
                <div className="flex flex-wrap gap-2">
                <Select value={dormFilter} onValueChange={setDormFilter}>
                  <SelectTrigger className="h-9 w-48"><SelectValue placeholder="All dormitories" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All dormitories</SelectItem>
                    {scopedDorms.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Dialog open={bulkOpen} onOpenChange={(o) => { setBulkOpen(o); if (!o) setBulkPlan(null); }}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline" disabled={scopedDorms.length === 0}><Upload className="mr-1 h-4 w-4" /> Upload worker list</Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Upload worker list (Excel)</DialogTitle>
                      <DialogDescription>Columns: P-File No or FIN, Dormitory, Room, Bed, Check in, Monthly rent, Remarks. Dormitory name must match exactly; seats are checked before saving.</DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button size="sm" variant="outline" onClick={downloadBulkTemplate}><FileSpreadsheet className="mr-1 h-4 w-4" /> Download template</Button>
                      <Input type="file" accept=".xlsx,.xls,.csv" className="max-w-xs" onChange={(e) => { void handleBulkFile(e.target.files?.[0]); e.target.value = ""; }} />
                    </div>
                    {bulkPlan && (
                      <div className="space-y-3">
                        <p className="text-sm">{bulkPlan.total} rows · <span className="font-medium text-success">{bulkPlan.valid.length} ready</span> · <span className="font-medium text-destructive">{bulkPlan.errors.length} with problems</span></p>
                        <div className="max-h-64 overflow-auto rounded-lg border">
                          <Table>
                            <TableHeader><TableRow><TableHead>Row</TableHead><TableHead>Worker</TableHead><TableHead>Dormitory</TableHead><TableHead>Room / Bed</TableHead><TableHead>Result</TableHead></TableRow></TableHeader>
                            <TableBody>
                              {bulkPlan.valid.map((p) => (
                                <TableRow key={`v${p.rowNumber}`}><TableCell>{p.rowNumber}</TableCell><TableCell>{p.workerLabel}</TableCell><TableCell>{p.dormLabel}</TableCell><TableCell>{p.roomNo}{p.bedNo ? ` / ${p.bedNo}` : ""}</TableCell><TableCell><StatusBadge variant="success" label="Ready" dot /></TableCell></TableRow>
                              ))}
                              {bulkPlan.errors.map((e) => (
                                <TableRow key={`e${e.rowNumber}`}><TableCell>{e.rowNumber}</TableCell><TableCell colSpan={3} className="text-destructive">{e.message}</TableCell><TableCell><StatusBadge variant="destructive" label="Skipped" dot /></TableCell></TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}
                    <DialogFooter>
                      <Button variant="outline" onClick={() => { setBulkOpen(false); setBulkPlan(null); }}>Cancel</Button>
                      <Button onClick={confirmBulk} disabled={!bulkPlan?.valid.length}>Allocate {bulkPlan?.valid.length ?? 0} workers</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                <Dialog open={allocOpen} onOpenChange={(o) => setAllocSession(o ? openAddAllocSession() : closedAllocSession())}>
                  <DialogTrigger asChild>
                    <Button size="sm" disabled={scopedDorms.length === 0}>
                      <Plus className="mr-1 h-4 w-4" /> Allocate bed
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{editAllocId ? "Edit allocation" : "Allocate bed"}</DialogTitle>
                      <DialogDescription>Assign a worker to a dormitory room.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <Label>Dormitory</Label>
                        <Select value={allocForm.dormitoryId} onValueChange={(v) => setAllocForm({ ...allocForm, dormitoryId: v })}>
                          <SelectTrigger><SelectValue placeholder="Select dormitory" /></SelectTrigger>
                          <SelectContent>
                            {scopedDorms.map((d) => (
                              <SelectItem key={d.id} value={d.id}>
                                {d.name} ({availableBeds(d, allocs)} free of {d.capacity})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="sm:col-span-2">
                        <Label>Worker</Label>
                        <Select disabled={!!editAllocId} value={allocForm.employeeId} onValueChange={(v) => setAllocForm({ ...allocForm, employeeId: v })}>
                          <SelectTrigger><SelectValue placeholder="Select worker" /></SelectTrigger>
                          <SelectContent>
                            {companyEmployees.map((e) => (
                              <SelectItem key={e.id} value={e.id}>{e.name} — {e.employeeCode}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div><Label>Room no</Label><Input value={allocForm.roomNo} onChange={(e) => setAllocForm({ ...allocForm, roomNo: e.target.value })} /></div>
                      <div><Label>Bed no</Label><Input value={allocForm.bedNo} onChange={(e) => setAllocForm({ ...allocForm, bedNo: e.target.value })} /></div>
                      <div><Label>Check-in date</Label><Input type="date" value={allocForm.checkInDate} onChange={(e) => setAllocForm({ ...allocForm, checkInDate: e.target.value })} /></div>
                      <div><Label>Monthly rent ($)</Label><Input type="number" value={allocForm.monthlyRent} onChange={(e) => setAllocForm({ ...allocForm, monthlyRent: Number(e.target.value) })} /></div>
                      {editAllocId && (
                        <div><Label>Status</Label>
                          <Select value={allocForm.status} onValueChange={(v) => setAllocForm({ ...allocForm, status: v as BedAllocation["status"] })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>{(["Occupied", "Reserved", "Vacated"] as const).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                      )}
                      <div className="sm:col-span-2"><Label>Remarks</Label><Textarea value={allocForm.remarks} onChange={(e) => setAllocForm({ ...allocForm, remarks: e.target.value })} /></div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setAllocSession(closedAllocSession())}>Cancel</Button>
                      <Button onClick={saveAlloc}>{editAllocId ? "Save" : "Allocate"}</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                </div>
              </div>

              <div className="mt-4 overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Worker</TableHead>
                      <TableHead>Dormitory</TableHead>
                      <TableHead>Room / Bed</TableHead>
                      <TableHead>Days Stayed</TableHead>
                      <TableHead>Check in</TableHead>
                      <TableHead>Monthly Rent</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-24"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAllocs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="h-32 text-center">
                          <EmptyState className="border-0 bg-transparent" icon={<BedDouble className="h-5 w-5" />} title="No allocations" description="Allocate a bed to get started." />
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredAllocs.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell>
                            <div className="font-medium">{empName(a.employeeId)}</div>
                            <div className="text-xs text-muted-foreground">{empCode(a.employeeId)}</div>
                          </TableCell>
                          <TableCell>{dormName(a.dormitoryId)}</TableCell>
                          <TableCell>{a.roomNo}{a.bedNo ? ` / ${a.bedNo}` : ""}</TableCell>
                          <TableCell>
                            {a.status === "Occupied" ? (
                              <span className="font-medium text-primary">
                                {Math.max(0, Math.floor((new Date().getTime() - new Date(a.checkInDate).getTime()) / (1000 * 60 * 60 * 24)))} days
                              </span>
                            ) : a.checkOutDate ? (
                              <span className="text-muted-foreground">
                                {Math.max(0, Math.floor((new Date(a.checkOutDate).getTime() - new Date(a.checkInDate).getTime()) / (1000 * 60 * 60 * 24)))} days
                              </span>
                            ) : "—"}
                          </TableCell>
                          <TableCell>{a.checkInDate}</TableCell>
                          <TableCell>${a.monthlyRent.toLocaleString()}</TableCell>
                          <TableCell>
                            <StatusBadge
                              variant={a.status === "Occupied" ? "success" : a.status === "Reserved" ? "warning" : "ghost"}
                              label={a.status}
                              dot
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-1">
                              <Button size="icon" variant="ghost" title="Edit" onClick={() => openEditAlloc(a)}><Pencil className="h-4 w-4" /></Button>
                              {a.status !== "Vacated" && (
                                <Button size="icon" variant="ghost" title="Move out" onClick={() => { checkOutAllocation(a.id); refresh(); toast.success("Marked as moved out"); }}>
                                  <LogOut className="h-4 w-4" />
                                </Button>
                              )}
                              <Button size="icon" variant="ghost" title="Delete" onClick={() => { deleteAllocation(a.id); refresh(); }}>
                                <Trash2 className="h-4 w-4 text-destructive" />
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
          </TabsContent>

          <TabsContent value="dormitories" className="mt-4">
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium text-muted-foreground">Dormitory master</h2>
                <Dialog open={dormOpen} onOpenChange={(o) => setDormSession(o ? openAddDormSession() : closedDormSession())}>
                  <DialogTrigger asChild>
                    <Button size="sm"><Plus className="mr-1 h-4 w-4" /> Add dormitory</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{editDormId ? "Edit dormitory" : "Add dormitory"}</DialogTitle>
                      <DialogDescription>Register housing with capacity and licence details.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="sm:col-span-2"><Label>Name</Label><Input value={dormForm.name} onChange={(e) => setDormForm({ ...dormForm, name: e.target.value })} /></div>
                      <div className="sm:col-span-2"><Label>Address</Label><Input value={dormForm.address} onChange={(e) => setDormForm({ ...dormForm, address: e.target.value })} /></div>
                      <div><Label>Operator</Label><Input value={dormForm.operator} onChange={(e) => setDormForm({ ...dormForm, operator: e.target.value })} /></div>
                      <div><Label>Contact person</Label><Input value={dormForm.contactPerson} onChange={(e) => setDormForm({ ...dormForm, contactPerson: e.target.value })} /></div>
                      <div><Label>Contact phone</Label><Input value={dormForm.contactPhone} onChange={(e) => setDormForm({ ...dormForm, contactPhone: e.target.value })} /></div>
                      <div><Label>Capacity (beds)</Label><Input type="number" value={dormForm.capacity} onChange={(e) => setDormForm({ ...dormForm, capacity: Number(e.target.value) })} /></div>
                      <div><Label>Sleeping area (m²)</Label><Input type="number" value={dormForm.floorAreaSqm} onChange={(e) => setDormForm({ ...dormForm, floorAreaSqm: Number(e.target.value) })} /></div>
                      <div><Label>Rooms</Label><Input type="number" value={dormForm.rooms} onChange={(e) => setDormForm({ ...dormForm, rooms: Number(e.target.value) })} /></div>
                      <div><Label>Rent per bed ($)</Label><Input type="number" value={dormForm.monthlyRent} onChange={(e) => setDormForm({ ...dormForm, monthlyRent: Number(e.target.value) })} /></div>
                      <div><Label>Licence no</Label><Input value={dormForm.licenseNo} onChange={(e) => setDormForm({ ...dormForm, licenseNo: e.target.value })} /></div>
                      <div><Label>Licence expiry</Label><Input type="date" value={dormForm.licenseExpiry} onChange={(e) => setDormForm({ ...dormForm, licenseExpiry: e.target.value })} /></div>
                      <div><Label>Last inspection</Label><Input type="date" value={dormForm.lastInspection} onChange={(e) => setDormForm({ ...dormForm, lastInspection: e.target.value })} /></div>
                      <div><Label>Status</Label>
                        <Select value={dormForm.status} onValueChange={(v) => setDormForm({ ...dormForm, status: v as Dormitory["status"] })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="Active">Active</SelectItem><SelectItem value="Inactive">Inactive</SelectItem><SelectItem value="Full">Full</SelectItem></SelectContent>
                        </Select>
                      </div>
                      <div className="sm:col-span-2"><Label>Remarks</Label><Textarea value={dormForm.remarks} onChange={(e) => setDormForm({ ...dormForm, remarks: e.target.value })} /></div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setDormSession(closedDormSession())}>Cancel</Button>
                      <Button onClick={saveDorm}>Save</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="mt-4 overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Dormitory</TableHead>
                      <TableHead>Address</TableHead>
                      <TableHead>Occupancy</TableHead>
                      <TableHead>Available</TableHead>
                      <TableHead>MOM space</TableHead>
                      <TableHead>Rent / bed</TableHead>
                      <TableHead>Licence expiry</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-24"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scopedDorms.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="h-32 text-center">
                          <EmptyState className="border-0 bg-transparent" icon={<Building2 className="h-5 w-5" />} title="No dormitories" description="Add your first dormitory." />
                        </TableCell>
                      </TableRow>
                    ) : (
                      scopedDorms.map((d) => (
                        <TableRow key={d.id}>
                          <TableCell>
                            <div className="font-medium">{d.name}</div>
                            <div className="text-xs text-muted-foreground">{d.operator || "—"}</div>
                          </TableCell>
                          <TableCell className="max-w-[220px] truncate">{d.address || "—"}</TableCell>
                          <TableCell>{dormOccupancy(d.id)} / {d.capacity}</TableCell>
                          <TableCell><StatusBadge variant={availableBeds(d, allocs) > 0 ? "success" : "destructive"} label={`${availableBeds(d, allocs)} free`} dot /></TableCell>
                          <TableCell>
                            {(() => {
                              const check = dormCapacityCheck(d, dormOccupancy(d.id));
                              if (!d.floorAreaSqm) return <span className="text-xs text-muted-foreground">Area not set</span>;
                              return (
                                <div className="text-xs">
                                  <StatusBadge
                                    variant={check.overCapacity ? "destructive" : "success"}
                                    label={check.overCapacity ? "Over MOM limit" : "Within limit"}
                                    dot
                                  />
                                  <div className="mt-1 text-muted-foreground">
                                    {check.allowedByArea} beds @ {SQM_PER_RESIDENT} m²
                                    {check.sqmPerResident ? ` · now ${check.sqmPerResident} m²/pax` : ""}
                                  </div>
                                </div>
                              );
                            })()}
                          </TableCell>
                          <TableCell>${d.monthlyRent.toLocaleString()}</TableCell>
                          <TableCell>{d.licenseExpiry || "—"}</TableCell>
                          <TableCell><StatusBadge variant={d.status === "Active" ? "success" : "ghost"} label={d.status} dot /></TableCell>
                          <TableCell>
                            <Button size="icon" variant="ghost" title="Edit" onClick={() => openEditDorm(d)}><Pencil className="h-4 w-4" /></Button>
                            <Button size="icon" variant="ghost" title="Delete" onClick={() => { if (confirm(`Delete ${d.name}?`)) { deleteDormitory(d.id); refresh(); } }}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="invoices" className="mt-4">
            <DormitoryBilling dormitories={scopedDorms} companyId={companyId || null} />
          </TabsContent>

          <TabsContent value="inspections" className="mt-4">
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium text-muted-foreground">Inspection Logs</h2>
                <Button size="sm" disabled title="Dormitory inspections are unavailable">
                  <Plus className="mr-1 h-4 w-4" /> New inspection
                </Button>
              </div>
              
              <div className="mt-4 overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Dormitory</TableHead>
                      <TableHead>Inspector</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Findings</TableHead>
                      <TableHead className="w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getDormitoryInspections().length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                          Dormitory inspections are unavailable in the connected database.
                        </TableCell>
                      </TableRow>
                    ) : (
                      getDormitoryInspections().map((insp) => (
                        <TableRow key={insp.id}>
                          <TableCell>{insp.inspectionDate}</TableCell>
                          <TableCell>{dormName(insp.dormitoryId)}</TableCell>
                          <TableCell>{insp.inspectorName || "—"}</TableCell>
                          <TableCell><StatusBadge variant={insp.status === "Passed" ? "success" : "destructive"} label={insp.status} dot /></TableCell>
                          <TableCell className="max-w-[200px] truncate">{insp.findings || "—"}</TableCell>
                          <TableCell>
                            <Button size="icon" variant="ghost" disabled aria-label="Inspection details unavailable">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <h2 className="text-sm font-medium text-muted-foreground">Worker Movement History</h2>
              <div className="mt-4 overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Worker</TableHead>
                      <TableHead>From</TableHead>
                      <TableHead>To</TableHead>
                      <TableHead>Room</TableHead>
                      <TableHead>Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getDormitoryMovements().length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                          Dormitory movement history is unavailable in the connected database.
                        </TableCell>
                      </TableRow>
                    ) : (
                      getDormitoryMovements().map((m) => (
                        <TableRow key={m.id}>
                          <TableCell>{m.moveDate}</TableCell>
                          <TableCell>
                            <div className="font-medium">{empName(m.employeeId)}</div>
                            <div className="text-xs text-muted-foreground">{empCode(m.employeeId)}</div>
                          </TableCell>
                          <TableCell>{m.fromDormitoryId ? dormName(m.fromDormitoryId) : "Initial Allocation"}</TableCell>
                          <TableCell>{m.toDormitoryId ? dormName(m.toDormitoryId) : "Vacated"}</TableCell>
                          <TableCell>{m.toRoom || m.fromRoom || "—"}</TableCell>
                          <TableCell>{m.reason || "—"}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="mom-address" className="mt-4">
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <HousingNotificationPanel />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
