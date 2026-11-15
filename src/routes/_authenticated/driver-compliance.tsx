import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Fuel, Plus, Trash2, Download, CheckCircle2, Gauge } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { ConfirmRecordDelete } from "@/components/confirm-record-action";
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
  getEmployees, getVehicles, getCurrentCompany, getDriverIncidents, getFuelLogs,
  addDriverIncident, updateDriverIncident, deleteDriverIncident, addFuelLog, deleteFuelLog,
} from "@/lib/store";
import { isDriver } from "@/lib/workforce-split";
import { exportRows } from "@/lib/xlsx";
import type { DriverIncident } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/driver-compliance")({
  head: () => ({
    meta: [
      { title: "Driver Compliance & Fuel — BSM Workforce & Operations" },
      { name: "description", content: "Traffic offences, accidents, demerit points, fines and fuel / mileage logs per driver and vehicle." },
      { property: "og:title", content: "Driver Compliance & Fuel — BSM Workforce & Operations" },
      { property: "og:description", content: "Track offences, fines, demerit points and fuel consumption per vehicle." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DriverCompliancePage,
});

const today = () => new Date().toISOString().slice(0, 10);
const incidentTypes: DriverIncident["incidentType"][] = ["Traffic Offence", "Accident", "Damage", "Summons", "Other"];

const emptyIncident = {
  employeeId: "", vehicleId: "", date: today(),
  incidentType: "Traffic Offence" as DriverIncident["incidentType"],
  description: "", demeritPoints: 0, fineAmount: 0,
  paidBy: "Company" as DriverIncident["paidBy"], status: "Open" as DriverIncident["status"],
};

const emptyFuel = {
  vehicleId: "", employeeId: "", date: today(), odometer: 0, litres: 0, amount: 0, station: "", remarks: "",
};

function DriverCompliancePage() {
  const companyId = getCurrentCompany();
  const employees = getEmployees();
  const vehicles = getVehicles();
  const [incidents, setIncidents] = useState(getDriverIncidents());
  const [fuel, setFuel] = useState(getFuelLogs());
  const [iOpen, setIOpen] = useState(false);
  const [fOpen, setFOpen] = useState(false);
  const [iForm, setIForm] = useState(emptyIncident);
  const [fForm, setFForm] = useState(emptyFuel);

  function refresh() {
    setIncidents(getDriverIncidents());
    setFuel(getFuelLogs());
  }

  const drivers = employees.filter((e) => isDriver(e));
  const scopedVehicles = vehicles.filter((v) => !companyId || !v.companyId || v.companyId === companyId);
  const vehicleIds = new Set(scopedVehicles.map((v) => v.id));
  const empName = (id?: string) => (id ? employees.find((e) => e.id === id)?.name ?? "—" : "—");
  const plate = (id?: string) => (id ? vehicles.find((v) => v.id === id)?.plateNo ?? "—" : "—");

  const driverIds = new Set(drivers.map((d) => d.id));
  const scopedIncidents = incidents.filter((i) => driverIds.has(i.employeeId));
  const scopedFuel = fuel.filter((f) => vehicleIds.has(f.vehicleId));

  const month = today().slice(0, 7);
  const monthFuel = scopedFuel.filter((f) => f.date.startsWith(month));
  const fuelSpend = monthFuel.reduce((s, f) => s + f.amount, 0);
  const litres = monthFuel.reduce((s, f) => s + f.litres, 0);
  const openIncidents = scopedIncidents.filter((i) => i.status === "Open").length;
  const fines = scopedIncidents.reduce((s, i) => s + i.fineAmount, 0);

  function saveIncident() {
    if (!iForm.employeeId) return toast.error("Select a driver");
    if (!iForm.description.trim()) return toast.error("Description required");
    addDriverIncident({ ...iForm, vehicleId: iForm.vehicleId || undefined });
    setIForm(emptyIncident);
    setIOpen(false);
    refresh();
    toast.success("Incident logged");
  }

  function saveFuel() {
    if (!fForm.vehicleId) return toast.error("Select a vehicle");
    addFuelLog({ ...fForm, employeeId: fForm.employeeId || undefined });
    setFForm(emptyFuel);
    setFOpen(false);
    refresh();
    toast.success("Fuel log added");
  }

  function exportIncidents() {
    void exportRows(
      scopedIncidents.map((i) => ({
        Date: i.date, Driver: empName(i.employeeId), Vehicle: plate(i.vehicleId),
        Type: i.incidentType, Description: i.description, "Demerit points": i.demeritPoints,
        "Fine ($)": i.fineAmount, "Paid by": i.paidBy, Status: i.status,
      })),
      "driver-incidents", "Incidents",
    );
  }

  function exportFuel() {
    void exportRows(
      scopedFuel.map((f) => ({
        Date: f.date, Vehicle: plate(f.vehicleId), Driver: empName(f.employeeId),
        Odometer: f.odometer, Litres: f.litres, "Amount ($)": f.amount, Station: f.station ?? "",
      })),
      "driver-fuel-logs", "Fuel",
    );
  }

  return (
    <AppShell>
      <div className="w-full space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Driver Compliance & Fuel</h1>
          <p className="text-sm text-muted-foreground">
            Traffic offences, accidents, demerit points, fines and fuel / mileage per vehicle.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard title="Open cases" value={openIncidents.toString()} icon={<AlertTriangle className="h-5 w-5" />} variant="warning" caption="Offences & accidents" compact />
          <SummaryCard title="Total fines" value={`$${fines.toFixed(2)}`} icon={<Gauge className="h-5 w-5" />} variant="destructive" caption="All recorded cases" compact />
          <SummaryCard title="Fuel this month" value={`$${fuelSpend.toFixed(2)}`} icon={<Fuel className="h-5 w-5" />} variant="primary" caption={month} compact />
          <SummaryCard title="Litres this month" value={litres.toFixed(1)} icon={<Fuel className="h-5 w-5" />} variant="info" caption="Total refuelled" compact />
        </div>

        <Tabs defaultValue="incidents">
          <TabsList>
            <TabsTrigger value="incidents">Offences & accidents</TabsTrigger>
            <TabsTrigger value="fuel">Fuel & mileage</TabsTrigger>
          </TabsList>

          <TabsContent value="incidents" className="mt-4">
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-medium text-muted-foreground">Incident register</h2>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={exportIncidents} disabled={scopedIncidents.length === 0}>
                    <Download className="mr-1 h-4 w-4" /> Export
                  </Button>
                  <Dialog open={iOpen} onOpenChange={setIOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" disabled={drivers.length === 0}><Plus className="mr-1 h-4 w-4" /> Log incident</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Log incident</DialogTitle>
                        <DialogDescription>Traffic offence, accident or vehicle damage.</DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <Label>Driver</Label>
                          <Select value={iForm.employeeId} onValueChange={(v) => setIForm({ ...iForm, employeeId: v })}>
                            <SelectTrigger><SelectValue placeholder="Select driver" /></SelectTrigger>
                            <SelectContent>
                              {drivers.map((d) => (<SelectItem key={d.id} value={d.id}>{d.name} — {d.employeeCode}</SelectItem>))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Vehicle</Label>
                          <Select value={iForm.vehicleId} onValueChange={(v) => setIForm({ ...iForm, vehicleId: v })}>
                            <SelectTrigger><SelectValue placeholder="Select vehicle" /></SelectTrigger>
                            <SelectContent>
                              {scopedVehicles.map((v) => (<SelectItem key={v.id} value={v.id}>{v.plateNo}</SelectItem>))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div><Label>Date</Label><Input type="date" value={iForm.date} onChange={(e) => setIForm({ ...iForm, date: e.target.value })} /></div>
                        <div>
                          <Label>Type</Label>
                          <Select value={iForm.incidentType} onValueChange={(v) => setIForm({ ...iForm, incidentType: v as DriverIncident["incidentType"] })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {incidentTypes.map((t) => (<SelectItem key={t} value={t}>{t}</SelectItem>))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div><Label>Demerit points</Label><Input type="number" value={iForm.demeritPoints} onChange={(e) => setIForm({ ...iForm, demeritPoints: Number(e.target.value) })} /></div>
                        <div><Label>Fine amount ($)</Label><Input type="number" value={iForm.fineAmount} onChange={(e) => setIForm({ ...iForm, fineAmount: Number(e.target.value) })} /></div>
                        <div>
                          <Label>Paid by</Label>
                          <Select value={iForm.paidBy} onValueChange={(v) => setIForm({ ...iForm, paidBy: v as DriverIncident["paidBy"] })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Company">Company</SelectItem>
                              <SelectItem value="Driver">Driver (salary deduction)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="sm:col-span-2"><Label>Description</Label><Textarea value={iForm.description} onChange={(e) => setIForm({ ...iForm, description: e.target.value })} /></div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIOpen(false)}>Cancel</Button>
                        <Button onClick={saveIncident}>Save</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>

              <div className="mt-4 overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Driver</TableHead>
                      <TableHead>Vehicle</TableHead>
                      <TableHead>Type / description</TableHead>
                      <TableHead>Demerit</TableHead>
                      <TableHead>Fine</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="sticky right-0 bg-card w-24 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scopedIncidents.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="h-32 text-center">
                          <EmptyState className="border-0 bg-transparent" icon={<AlertTriangle className="h-5 w-5" />} title="No incidents" description="Clean record — nothing logged yet." />
                        </TableCell>
                      </TableRow>
                    ) : (
                      scopedIncidents.map((i) => (
                        <TableRow key={i.id}>
                          <TableCell>{i.date}</TableCell>
                          <TableCell className="font-medium">{empName(i.employeeId)}</TableCell>
                          <TableCell>{plate(i.vehicleId)}</TableCell>
                          <TableCell>
                            <div>{i.incidentType}</div>
                            <div className="text-xs text-muted-foreground">{i.description}</div>
                          </TableCell>
                          <TableCell>{i.demeritPoints}</TableCell>
                          <TableCell>
                            <div>${i.fineAmount.toFixed(2)}</div>
                            <div className="text-xs text-muted-foreground">{i.paidBy}</div>
                          </TableCell>
                          <TableCell>
                            <StatusBadge
                              variant={i.status === "Settled" ? "success" : i.status === "Appealed" ? "info" : "warning"}
                              label={i.status}
                              dot
                            />
                          </TableCell>
                          <TableCell className="sticky right-0 bg-card">
                            <div className="flex justify-end gap-1">
                              {i.status !== "Settled" && (
                                <Button size="icon" variant="ghost" title="Mark settled" onClick={() => { updateDriverIncident(i.id, { status: "Settled" }); refresh(); }}>
                                  <CheckCircle2 className="h-4 w-4" />
                                </Button>
                              )}
                              <ConfirmRecordDelete record={`incident on ${i.date} for ${empName(i.employeeId)}`} onConfirm={() => { deleteDriverIncident(i.id); refresh(); }} />
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

          <TabsContent value="fuel" className="mt-4">
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-medium text-muted-foreground">Fuel & mileage log</h2>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={exportFuel} disabled={scopedFuel.length === 0}>
                    <Download className="mr-1 h-4 w-4" /> Export
                  </Button>
                  <Dialog open={fOpen} onOpenChange={setFOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" disabled={scopedVehicles.length === 0}><Plus className="mr-1 h-4 w-4" /> Add fuel log</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add fuel log</DialogTitle>
                        <DialogDescription>Refuelling record with odometer reading.</DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <Label>Vehicle</Label>
                          <Select value={fForm.vehicleId} onValueChange={(v) => setFForm({ ...fForm, vehicleId: v })}>
                            <SelectTrigger><SelectValue placeholder="Select vehicle" /></SelectTrigger>
                            <SelectContent>
                              {scopedVehicles.map((v) => (<SelectItem key={v.id} value={v.id}>{v.plateNo}</SelectItem>))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Driver</Label>
                          <Select value={fForm.employeeId} onValueChange={(v) => setFForm({ ...fForm, employeeId: v })}>
                            <SelectTrigger><SelectValue placeholder="Select driver" /></SelectTrigger>
                            <SelectContent>
                              {drivers.map((d) => (<SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div><Label>Date</Label><Input type="date" value={fForm.date} onChange={(e) => setFForm({ ...fForm, date: e.target.value })} /></div>
                        <div><Label>Odometer (km)</Label><Input type="number" value={fForm.odometer} onChange={(e) => setFForm({ ...fForm, odometer: Number(e.target.value) })} /></div>
                        <div><Label>Litres</Label><Input type="number" value={fForm.litres} onChange={(e) => setFForm({ ...fForm, litres: Number(e.target.value) })} /></div>
                        <div><Label>Amount ($)</Label><Input type="number" value={fForm.amount} onChange={(e) => setFForm({ ...fForm, amount: Number(e.target.value) })} /></div>
                        <div><Label>Station</Label><Input value={fForm.station} onChange={(e) => setFForm({ ...fForm, station: e.target.value })} /></div>
                        <div className="sm:col-span-2"><Label>Remarks</Label><Textarea value={fForm.remarks} onChange={(e) => setFForm({ ...fForm, remarks: e.target.value })} /></div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setFOpen(false)}>Cancel</Button>
                        <Button onClick={saveFuel}>Save</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>

              <div className="mt-4 overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Vehicle</TableHead>
                      <TableHead>Driver</TableHead>
                      <TableHead>Odometer</TableHead>
                      <TableHead>Litres</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Station</TableHead>
                      <TableHead className="sticky right-0 bg-card w-16 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scopedFuel.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="h-32 text-center">
                          <EmptyState className="border-0 bg-transparent" icon={<Fuel className="h-5 w-5" />} title="No fuel logs" description="Add a refuelling record to track cost per vehicle." />
                        </TableCell>
                      </TableRow>
                    ) : (
                      scopedFuel.map((f) => (
                        <TableRow key={f.id}>
                          <TableCell>{f.date}</TableCell>
                          <TableCell className="font-medium">{plate(f.vehicleId)}</TableCell>
                          <TableCell>{empName(f.employeeId)}</TableCell>
                          <TableCell>{f.odometer ? `${f.odometer} km` : "—"}</TableCell>
                          <TableCell>{f.litres || "—"}</TableCell>
                          <TableCell>${f.amount.toFixed(2)}</TableCell>
                          <TableCell>{f.station || "—"}</TableCell>
                          <TableCell className="sticky right-0 bg-card">
                            <div className="flex justify-end">
                              <ConfirmRecordDelete record={`fuel log on ${f.date} for ${plate(f.vehicleId)}`} onConfirm={() => { deleteFuelLog(f.id); refresh(); }} />
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
        </Tabs>
      </div>
    </AppShell>
  );
}
