import { useState } from "react";
import { cn } from "@/lib/utils";
import { createFileRoute } from "@tanstack/react-router";
import { Truck, Route as RouteIcon, AlertTriangle, Users, Plus, Search, Trash2, Download, CheckCircle2, Wand2 } from "lucide-react";
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
import { TripCalendar } from "@/components/trip-calendar";
import {
  getVehicles, getTrips, getEmployees, getSites, getCurrentCompany,
  addVehicle, deleteVehicle, addTrip, updateTrip, deleteTrip, vehicleExpiryAlerts,
} from "@/lib/store";
import { exportRows } from "@/lib/xlsx";
import type { Vehicle, Trip, VehicleType } from "@/lib/types";
import { seedTransportDemoData } from "@/lib/seed-transport";

export const Route = createFileRoute("/_authenticated/transport")({
  head: () => ({
    meta: [
      { title: "Transport & Drivers — BSM Workforce & Operations" },
      { name: "description", content: "Vehicle master, driver assignment, daily trips and road tax / insurance alerts." },
      { property: "og:title", content: "Transport & Drivers — BSM Workforce & Operations" },
      { property: "og:description", content: "Vehicle master, driver assignment, daily trips and road tax / insurance alerts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TransportPage,
});

const vehicleTypes: VehicleType[] = ["Lorry", "Van", "Bus", "Car", "Pickup"];
const today = () => new Date().toISOString().slice(0, 10);

const emptyVehicle = {
  plateNo: "", type: "Lorry" as VehicleType, makeModel: "", capacity: 0, driverEmployeeId: "",
  roadTaxExpiry: "", insuranceExpiry: "", inspectionDue: "", status: "Active" as Vehicle["status"], remarks: "",
};

const emptyTrip = {
  vehicleId: "", driverEmployeeId: "", siteId: "", date: today(),
  departureTime: "", returnTime: "", route: "", passengers: 0,
  status: "Scheduled" as Trip["status"], notes: "",
};

export default function TransportPage() {
  const companyId = getCurrentCompany();
  const [vehicles, setVehicles] = useState(getVehicles());
  const [trips, setTrips] = useState(getTrips());
  const [employees] = useState(getEmployees());
  const [sites] = useState(getSites());
  const [search, setSearch] = useState("");
  const [vOpen, setVOpen] = useState(false);
  const [tOpen, setTOpen] = useState(false);
  const [vForm, setVForm] = useState(emptyVehicle);
  const [tForm, setTForm] = useState(emptyTrip);

  function refresh() {
    setVehicles(getVehicles());
    setTrips(getTrips());
  }

  const scopedVehicles = vehicles.filter((v) => !companyId || !v.companyId || v.companyId === companyId);
  const vehicleIds = new Set(scopedVehicles.map((v) => v.id));
  const scopedTrips = trips.filter((t) => vehicleIds.has(t.vehicleId));
  const companyEmployees = employees.filter((e) => !companyId || e.companyId === companyId);
  const empName = (id?: string) => (id ? employees.find((e) => e.id === id)?.name ?? "—" : "—");
  const plate = (id: string) => vehicles.find((v) => v.id === id)?.plateNo ?? "—";
  const siteName = (id?: string) => (id ? sites.find((s) => s.id === id)?.name ?? "—" : "—");

  const alerts = vehicleExpiryAlerts(60).filter((a) => vehicleIds.has(a.vehicle.id));
  const todaysTrips = scopedTrips.filter((t) => t.date === today());
  const paxToday = todaysTrips.reduce((s, t) => s + t.passengers, 0);

  const q = search.trim().toLowerCase();
  const filteredTrips = scopedTrips.filter(
    (t) => !q || plate(t.vehicleId).toLowerCase().includes(q) || (t.route ?? "").toLowerCase().includes(q) || siteName(t.siteId).toLowerCase().includes(q),
  );

  function saveVehicle() {
    if (!vForm.plateNo.trim()) return toast.error("Plate number required");
    addVehicle({ ...vForm, companyId: companyId || undefined, driverEmployeeId: vForm.driverEmployeeId || undefined });
    setVForm(emptyVehicle);
    setVOpen(false);
    refresh();
    toast.success("Vehicle added");
  }

  function saveTrip() {
    if (!tForm.vehicleId) return toast.error("Select a vehicle");
    addTrip({
      ...tForm,
      driverEmployeeId: tForm.driverEmployeeId || undefined,
      siteId: tForm.siteId || undefined,
    });
    setTForm(emptyTrip);
    setTOpen(false);
    refresh();
    toast.success("Trip scheduled");
  }

  function handleExport() {
    void exportRows(
      filteredTrips.map((t) => ({
        Date: t.date, Vehicle: plate(t.vehicleId), Driver: empName(t.driverEmployeeId),
        Site: siteName(t.siteId), Route: t.route ?? "", Departure: t.departureTime ?? "",
        Return: t.returnTime ?? "", Passengers: t.passengers, Status: t.status,
      })),
      "transport-trips", "Trips",
    );
  }

  return (
    <AppShell>
      <div className="w-full space-y-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Fleet Management (Transport)</h1>
            <p className="text-sm text-muted-foreground max-w-2xl">Manage company vehicles, maintenance schedules, road tax/insurance renewals, and coordinate daily worker transportation (trips) between dormitories and sites.</p>
          </div>
          <div className="flex gap-2 mt-2 sm:mt-0">
            <Button size="sm" variant="outline" onClick={handleExport} disabled={filteredTrips.length === 0}>
              <Download className="mr-1 h-4 w-4" /> Export
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard title="Vehicles" value={scopedVehicles.length.toString()} icon={<Truck className="h-5 w-5" />} variant="primary" caption="Fleet size" />
          <SummaryCard title="Trips today" value={todaysTrips.length.toString()} icon={<RouteIcon className="h-5 w-5" />} variant="default" caption="Scheduled runs" />
          <SummaryCard title="Workers moved" value={paxToday.toString()} icon={<Users className="h-5 w-5" />} variant="success" caption="Passengers today" />
          <SummaryCard title="Renewal alerts" value={alerts.length.toString()} icon={<AlertTriangle className="h-5 w-5" />} variant="warning" caption="Next 60 days" />
        </div>

        {alerts.length > 0 && (
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <h2 className="text-sm font-medium text-muted-foreground">Road tax, insurance & inspection</h2>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {alerts.slice(0, 6).map((a, idx) => (
                <li key={`${a.vehicle.id}-${idx}`} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                  <span className="font-medium">{a.vehicle.plateNo} — {a.label}</span>
                  <StatusBadge variant={a.expired ? "destructive" : "warning"} label={a.date} dot />
                </li>
              ))}
            </ul>
          </div>
        )}

        <Tabs defaultValue="trips">
          <TabsList>
            <TabsTrigger value="trips">Trips</TabsTrigger>
            <TabsTrigger value="calendar">Calendar</TabsTrigger>
            <TabsTrigger value="vehicles">Vehicles</TabsTrigger>
          </TabsList>

          <TabsContent value="calendar" className="mt-4">
            <TripCalendar trips={filteredTrips} plate={plate} siteName={siteName} driverName={empName} />
          </TabsContent>

          <TabsContent value="trips" className="mt-4">
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative w-full max-w-sm">
                  <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input type="search" placeholder="Search vehicle, route or site..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
                </div>
                <Dialog open={tOpen} onOpenChange={setTOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" disabled={scopedVehicles.length === 0}>
                      <Plus className="mr-1 h-4 w-4" /> Schedule trip
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Schedule trip</DialogTitle>
                      <DialogDescription>Plan a site pickup or drop-off run.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <Label>Vehicle</Label>
                        <Select value={tForm.vehicleId} onValueChange={(v) => {
                          const veh = vehicles.find((x) => x.id === v);
                          setTForm({ ...tForm, vehicleId: v, driverEmployeeId: veh?.driverEmployeeId ?? tForm.driverEmployeeId });
                        }}>
                          <SelectTrigger><SelectValue placeholder="Select vehicle" /></SelectTrigger>
                          <SelectContent>
                            {scopedVehicles.map((v) => (<SelectItem key={v.id} value={v.id}>{v.plateNo} — {v.type}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Driver</Label>
                        <Select value={tForm.driverEmployeeId} onValueChange={(v) => setTForm({ ...tForm, driverEmployeeId: v })}>
                          <SelectTrigger><SelectValue placeholder="Select driver" /></SelectTrigger>
                          <SelectContent>
                            {companyEmployees.map((e) => (<SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Site</Label>
                        <Select value={tForm.siteId} onValueChange={(v) => setTForm({ ...tForm, siteId: v })}>
                          <SelectTrigger><SelectValue placeholder="Select site" /></SelectTrigger>
                          <SelectContent>
                            {sites.map((s) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div><Label>Date</Label><Input type="date" value={tForm.date} onChange={(e) => setTForm({ ...tForm, date: e.target.value })} /></div>
                      <div><Label>Departure</Label><Input type="time" value={tForm.departureTime} onChange={(e) => setTForm({ ...tForm, departureTime: e.target.value })} /></div>
                      <div><Label>Return</Label><Input type="time" value={tForm.returnTime} onChange={(e) => setTForm({ ...tForm, returnTime: e.target.value })} /></div>
                      <div><Label>Passengers</Label><Input type="number" value={tForm.passengers} onChange={(e) => setTForm({ ...tForm, passengers: Number(e.target.value) })} /></div>
                      <div><Label>Route</Label><Input value={tForm.route} onChange={(e) => setTForm({ ...tForm, route: e.target.value })} placeholder="Dorm → Site" /></div>
                      <div className="sm:col-span-2"><Label>Notes</Label><Textarea value={tForm.notes} onChange={(e) => setTForm({ ...tForm, notes: e.target.value })} /></div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setTOpen(false)}>Cancel</Button>
                      <Button onClick={saveTrip}>Schedule</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="mt-4 overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Vehicle</TableHead>
                      <TableHead>Driver</TableHead>
                      <TableHead>Site / route</TableHead>
                      <TableHead>Timing</TableHead>
                      <TableHead>Pax</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-24"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTrips.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="h-32 text-center">
                          <EmptyState className="border-0 bg-transparent" icon={<RouteIcon className="h-5 w-5" />} title="No trips" description="Schedule a trip to get started." />
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredTrips.map((t) => (
                        <TableRow key={t.id}>
                          <TableCell>{t.date}</TableCell>
                          <TableCell className="font-medium">{plate(t.vehicleId)}</TableCell>
                          <TableCell>{empName(t.driverEmployeeId)}</TableCell>
                          <TableCell>
                            <div>{siteName(t.siteId)}</div>
                            <div className="text-xs font-medium text-primary">{t.route || "—"}</div>
                          </TableCell>
                          <TableCell className="text-xs">{t.departureTime || "—"} → {t.returnTime || "—"}</TableCell>
                          <TableCell>{t.passengers}</TableCell>
                          <TableCell>
                            <StatusBadge
                              variant={t.status === "Completed" ? "success" : t.status === "Cancelled" ? "ghost" : "warning"}
                              label={t.status}
                              dot
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-1">
                              {t.status === "Scheduled" && (
                                <Button size="icon" variant="ghost" title="Mark completed" onClick={() => { updateTrip(t.id, { status: "Completed" }); refresh(); }}>
                                  <CheckCircle2 className="h-4 w-4" />
                                </Button>
                              )}
                              <Button size="icon" variant="ghost" title="Delete" onClick={() => { deleteTrip(t.id); refresh(); }}>
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

          <TabsContent value="vehicles" className="mt-4">
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium text-muted-foreground">Vehicle master</h2>
                <Dialog open={vOpen} onOpenChange={setVOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm"><Plus className="mr-1 h-4 w-4" /> Add vehicle</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add vehicle</DialogTitle>
                      <DialogDescription>Register a company vehicle with renewal dates.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div><Label>Plate no</Label><Input value={vForm.plateNo} onChange={(e) => setVForm({ ...vForm, plateNo: e.target.value.toUpperCase() })} /></div>
                      <div>
                        <Label>Type</Label>
                        <Select value={vForm.type} onValueChange={(v) => setVForm({ ...vForm, type: v as VehicleType })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {vehicleTypes.map((t) => (<SelectItem key={t} value={t}>{t}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div><Label>Make / model</Label><Input value={vForm.makeModel} onChange={(e) => setVForm({ ...vForm, makeModel: e.target.value })} /></div>
                      <div><Label>Seating capacity</Label><Input type="number" value={vForm.capacity} onChange={(e) => setVForm({ ...vForm, capacity: Number(e.target.value) })} /></div>
                      <div className="sm:col-span-2">
                        <Label>Assigned driver</Label>
                        <Select value={vForm.driverEmployeeId} onValueChange={(v) => setVForm({ ...vForm, driverEmployeeId: v })}>
                          <SelectTrigger><SelectValue placeholder="Select driver" /></SelectTrigger>
                          <SelectContent>
                            {companyEmployees.map((e) => (<SelectItem key={e.id} value={e.id}>{e.name} — {e.employeeCode}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div><Label>Road tax expiry</Label><Input type="date" value={vForm.roadTaxExpiry} onChange={(e) => setVForm({ ...vForm, roadTaxExpiry: e.target.value })} /></div>
                      <div><Label>Insurance expiry</Label><Input type="date" value={vForm.insuranceExpiry} onChange={(e) => setVForm({ ...vForm, insuranceExpiry: e.target.value })} /></div>
                      <div><Label>Inspection due</Label><Input type="date" value={vForm.inspectionDue} onChange={(e) => setVForm({ ...vForm, inspectionDue: e.target.value })} /></div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setVOpen(false)}>Cancel</Button>
                      <Button onClick={saveVehicle}>Save</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="mt-4 overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Plate</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Driver</TableHead>
                      <TableHead>Capacity</TableHead>
                      <TableHead>Road tax (Days)</TableHead>
                      <TableHead>Insurance</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scopedVehicles.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="h-32 text-center">
                          <EmptyState className="border-0 bg-transparent" icon={<Truck className="h-5 w-5" />} title="No vehicles" description="Add your first vehicle." />
                        </TableCell>
                      </TableRow>
                    ) : (
                      scopedVehicles.map((v) => (
                        <TableRow key={v.id}>
                          <TableCell>
                            <div className="font-medium">{v.plateNo}</div>
                            <div className="text-xs text-muted-foreground">{v.makeModel || "—"}</div>
                          </TableCell>
                          <TableCell>{v.type}</TableCell>
                          <TableCell>{empName(v.driverEmployeeId)}</TableCell>
                          <TableCell>{v.capacity}</TableCell>
                          <TableCell>
                            <div>{v.roadTaxExpiry || "—"}</div>
                            {v.roadTaxExpiry && (
                              <div className={cn("text-[10px] font-bold", 
                                Math.ceil((new Date(v.roadTaxExpiry).getTime() - new Date().getTime()) / 86400000) <= 7 ? "text-destructive" : "text-muted-foreground"
                              )}>
                                {Math.ceil((new Date(v.roadTaxExpiry).getTime() - new Date().getTime()) / 86400000)} days left
                              </div>
                            )}
                          </TableCell>
                          <TableCell>{v.insuranceExpiry || "—"}</TableCell>
                          <TableCell><StatusBadge variant={v.status === "Active" ? "success" : v.status === "In Workshop" ? "warning" : "ghost"} label={v.status} dot /></TableCell>
                          <TableCell>
                            <Button size="icon" variant="ghost" title="Delete" onClick={() => { deleteVehicle(v.id); refresh(); }}>
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
