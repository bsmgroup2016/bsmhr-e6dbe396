import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Building2, BedDouble, Users, Plus, Search, Trash2, LogOut, Download } from "lucide-react";
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
  addDormitory, deleteDormitory, addAllocation, checkOutAllocation, deleteAllocation, dormOccupancy,
} from "@/lib/store";
import { exportRows } from "@/lib/xlsx";
import type { Dormitory, BedAllocation } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/accommodation")({
  head: () => ({
    meta: [
      { title: "Accommodation — BSM Workforce & Operations" },
      { name: "description", content: "Dormitory master, room allocation, occupancy and move in / move out tracking." },
      { property: "og:title", content: "Accommodation — BSM Workforce & Operations" },
      { property: "og:description", content: "Dormitory master, room allocation, occupancy and move in / move out tracking." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AccommodationPage,
});

const today = () => new Date().toISOString().slice(0, 10);

const emptyDorm = {
  name: "", address: "", operator: "", contactPerson: "", contactPhone: "",
  capacity: 0, monthlyRent: 0, licenseNo: "", licenseExpiry: "", lastInspection: "",
  status: "Active" as Dormitory["status"], remarks: "",
};

const emptyAlloc = {
  dormitoryId: "", employeeId: "", roomNo: "", bedNo: "",
  checkInDate: today(), monthlyRent: 0, status: "Occupied" as BedAllocation["status"], remarks: "",
};

export default function AccommodationPage() {
  const companyId = getCurrentCompany();
  const [dorms, setDorms] = useState(getDormitories());
  const [allocs, setAllocs] = useState(getAllocations());
  const [employees] = useState(getEmployees());
  const [search, setSearch] = useState("");
  const [dormOpen, setDormOpen] = useState(false);
  const [allocOpen, setAllocOpen] = useState(false);
  const [dormForm, setDormForm] = useState(emptyDorm);
  const [allocForm, setAllocForm] = useState(emptyAlloc);

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
  );

  function saveDorm() {
    if (!dormForm.name.trim()) return toast.error("Dormitory name required");
    addDormitory({ ...dormForm, companyId: companyId || undefined });
    setDormForm(emptyDorm);
    setDormOpen(false);
    refresh();
    toast.success("Dormitory added");
  }

  function saveAlloc() {
    if (!allocForm.dormitoryId || !allocForm.employeeId || !allocForm.roomNo.trim()) {
      return toast.error("Dormitory, worker and room number required");
    }
    const dorm = dorms.find((d) => d.id === allocForm.dormitoryId);
    if (dorm && dorm.capacity > 0 && dormOccupancy(dorm.id) >= dorm.capacity) {
      return toast.error(`${dorm.name} is at full capacity`);
    }
    addAllocation({
      ...allocForm,
      monthlyRent: allocForm.monthlyRent || dorm?.monthlyRent || 0,
    });
    setAllocForm(emptyAlloc);
    setAllocOpen(false);
    refresh();
    toast.success("Bed allocated");
  }

  function handleExport() {
    void exportRows(
      filteredAllocs.map((a) => ({
        Worker: empName(a.employeeId),
        "Employee code": empCode(a.employeeId),
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
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Accommodation</h1>
            <p className="text-sm text-muted-foreground">Dormitories, bed allocation and occupancy tracking.</p>
          </div>
          <Button size="sm" variant="outline" className="mt-2 sm:mt-0" onClick={handleExport} disabled={filteredAllocs.length === 0}>
            <Download className="mr-1 h-4 w-4" /> Export
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard title="Dormitories" value={scopedDorms.length.toString()} icon={<Building2 className="h-5 w-5" />} variant="primary" caption="Registered housing" />
          <SummaryCard title="Total beds" value={totalBeds.toString()} icon={<BedDouble className="h-5 w-5" />} variant="default" caption="Licensed capacity" />
          <SummaryCard title="Occupied" value={`${occupied}`} icon={<Users className="h-5 w-5" />} variant="success" caption={`${totalBeds ? Math.round((occupied / totalBeds) * 100) : 0}% utilisation`} />
          <SummaryCard title="Monthly rent" value={`S$${monthlyCost.toLocaleString()}`} icon={<BedDouble className="h-5 w-5" />} variant="warning" caption="Active allocations" />
        </div>

        <Tabs defaultValue="allocations">
          <TabsList>
            <TabsTrigger value="allocations">Allocations</TabsTrigger>
            <TabsTrigger value="dormitories">Dormitories</TabsTrigger>
          </TabsList>

          <TabsContent value="allocations" className="mt-4">
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative w-full max-w-sm">
                  <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input type="search" placeholder="Search worker, dorm or room..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
                </div>
                <Dialog open={allocOpen} onOpenChange={setAllocOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" disabled={scopedDorms.length === 0}>
                      <Plus className="mr-1 h-4 w-4" /> Allocate bed
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Allocate bed</DialogTitle>
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
                                {d.name} ({dormOccupancy(d.id)}/{d.capacity})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="sm:col-span-2">
                        <Label>Worker</Label>
                        <Select value={allocForm.employeeId} onValueChange={(v) => setAllocForm({ ...allocForm, employeeId: v })}>
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
                      <div><Label>Monthly rent (S$)</Label><Input type="number" value={allocForm.monthlyRent} onChange={(e) => setAllocForm({ ...allocForm, monthlyRent: Number(e.target.value) })} /></div>
                      <div className="sm:col-span-2"><Label>Remarks</Label><Textarea value={allocForm.remarks} onChange={(e) => setAllocForm({ ...allocForm, remarks: e.target.value })} /></div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setAllocOpen(false)}>Cancel</Button>
                      <Button onClick={saveAlloc}>Allocate</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="mt-4 overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Worker</TableHead>
                      <TableHead>Dormitory</TableHead>
                      <TableHead>Room / Bed</TableHead>
                      <TableHead>Check in</TableHead>
                      <TableHead>Check out</TableHead>
                      <TableHead>Rent</TableHead>
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
                          <TableCell>{a.checkInDate}</TableCell>
                          <TableCell>{a.checkOutDate ?? "—"}</TableCell>
                          <TableCell>S${a.monthlyRent.toLocaleString()}</TableCell>
                          <TableCell>
                            <StatusBadge
                              variant={a.status === "Occupied" ? "success" : a.status === "Reserved" ? "warning" : "muted"}
                              label={a.status}
                              dot
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-1">
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
                <Dialog open={dormOpen} onOpenChange={setDormOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm"><Plus className="mr-1 h-4 w-4" /> Add dormitory</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add dormitory</DialogTitle>
                      <DialogDescription>Register housing with capacity and licence details.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="sm:col-span-2"><Label>Name</Label><Input value={dormForm.name} onChange={(e) => setDormForm({ ...dormForm, name: e.target.value })} /></div>
                      <div className="sm:col-span-2"><Label>Address</Label><Input value={dormForm.address} onChange={(e) => setDormForm({ ...dormForm, address: e.target.value })} /></div>
                      <div><Label>Operator</Label><Input value={dormForm.operator} onChange={(e) => setDormForm({ ...dormForm, operator: e.target.value })} /></div>
                      <div><Label>Contact person</Label><Input value={dormForm.contactPerson} onChange={(e) => setDormForm({ ...dormForm, contactPerson: e.target.value })} /></div>
                      <div><Label>Contact phone</Label><Input value={dormForm.contactPhone} onChange={(e) => setDormForm({ ...dormForm, contactPhone: e.target.value })} /></div>
                      <div><Label>Capacity (beds)</Label><Input type="number" value={dormForm.capacity} onChange={(e) => setDormForm({ ...dormForm, capacity: Number(e.target.value) })} /></div>
                      <div><Label>Rent per bed (S$)</Label><Input type="number" value={dormForm.monthlyRent} onChange={(e) => setDormForm({ ...dormForm, monthlyRent: Number(e.target.value) })} /></div>
                      <div><Label>Licence no</Label><Input value={dormForm.licenseNo} onChange={(e) => setDormForm({ ...dormForm, licenseNo: e.target.value })} /></div>
                      <div><Label>Licence expiry</Label><Input type="date" value={dormForm.licenseExpiry} onChange={(e) => setDormForm({ ...dormForm, licenseExpiry: e.target.value })} /></div>
                      <div><Label>Last inspection</Label><Input type="date" value={dormForm.lastInspection} onChange={(e) => setDormForm({ ...dormForm, lastInspection: e.target.value })} /></div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setDormOpen(false)}>Cancel</Button>
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
                      <TableHead>Rent / bed</TableHead>
                      <TableHead>Licence expiry</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scopedDorms.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="h-32 text-center">
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
                          <TableCell>S${d.monthlyRent.toLocaleString()}</TableCell>
                          <TableCell>{d.licenseExpiry || "—"}</TableCell>
                          <TableCell><StatusBadge variant={d.status === "Active" ? "success" : "muted"} label={d.status} dot /></TableCell>
                          <TableCell>
                            <Button size="icon" variant="ghost" title="Delete" onClick={() => { deleteDormitory(d.id); refresh(); }}>
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
        </Tabs>
      </div>
    </AppShell>
  );
}
