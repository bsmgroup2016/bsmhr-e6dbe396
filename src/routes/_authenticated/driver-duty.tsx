import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Route as RouteIcon, Plus, CheckCircle2, Trash2, Download, Users, Clock, Truck } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { SummaryCard } from "@/components/ui/summary-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  getTrips, getVehicles, getEmployees, getSites, getCurrentCompany, getDriverProfiles,
  addTrip, updateTrip, deleteTrip,
} from "@/lib/store";
import { isDriver } from "@/lib/workforce-split";
import { exportRows } from "@/lib/xlsx";
import type { Trip } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/driver-duty")({
  head: () => ({
    meta: [
      { title: "Driver Duty Roster — BSM Workforce & Operations" },
      { name: "description", content: "Daily driver duty roster: vehicle, site route, departure and return times with duty hours." },
      { property: "og:title", content: "Driver Duty Roster — BSM Workforce & Operations" },
      { property: "og:description", content: "Assign drivers to daily runs and track duty hours per driver." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DriverDutyPage,
});

const today = () => new Date().toISOString().slice(0, 10);

const emptyTrip = {
  vehicleId: "", driverEmployeeId: "", siteId: "", date: today(),
  departureTime: "", returnTime: "", route: "", passengers: 0,
  status: "Scheduled" as Trip["status"], notes: "",
};

function hours(from?: string, to?: string) {
  if (!from || !to) return 0;
  const [fh, fm] = from.split(":").map(Number);
  const [th, tm] = to.split(":").map(Number);
  if ([fh, fm, th, tm].some((n) => Number.isNaN(n))) return 0;
  return Math.max(0, Math.round(((th * 60 + tm - (fh * 60 + fm)) / 60) * 100) / 100);
}

function DriverDutyPage() {
  const companyId = getCurrentCompany();
  const [trips, setTrips] = useState(getTrips());
  const employees = getEmployees();
  const vehicles = getVehicles();
  const sites = getSites();
  const profiles = getDriverProfiles();
  const [date, setDate] = useState(today());
  const [driverFilter, setDriverFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyTrip);

  const refresh = () => setTrips(getTrips());

  const drivers = employees.filter((e) => isDriver(e) && (!companyId || !e.companyId || e.companyId === companyId));
  const driverIds = new Set(drivers.map((d) => d.id));
  const empName = (id?: string) => (id ? employees.find((e) => e.id === id)?.name ?? "—" : "Unassigned");
  const plate = (id: string) => vehicles.find((v) => v.id === id)?.plateNo ?? "—";
  const siteName = (id?: string) => (id ? sites.find((s) => s.id === id)?.name ?? "—" : "—");

  const scopedVehicles = vehicles.filter((v) => !companyId || !v.companyId || v.companyId === companyId);
  const vehicleIds = new Set(scopedVehicles.map((v) => v.id));
  const driverTrips = trips.filter((t) => vehicleIds.has(t.vehicleId));

  const dayTrips = driverTrips.filter(
    (t) => t.date === date && (driverFilter === "all" || t.driverEmployeeId === driverFilter),
  );
  const onDuty = new Set(dayTrips.filter((t) => t.driverEmployeeId).map((t) => t.driverEmployeeId!)).size;
  const idle = drivers.length - onDuty;
  const pax = dayTrips.reduce((s, t) => s + t.passengers, 0);
  const dutyHours = dayTrips.reduce((s, t) => s + hours(t.departureTime, t.returnTime), 0);

  const perDriver = drivers
    .map((d) => {
      const list = driverTrips.filter((t) => t.driverEmployeeId === d.id && t.date === date);
      return {
        driver: d,
        trips: list.length,
        hours: Math.round(list.reduce((s, t) => s + hours(t.departureTime, t.returnTime), 0) * 100) / 100,
      };
    })
    .filter((r) => r.trips > 0);

  const unassigned = dayTrips.filter((t) => !t.driverEmployeeId).length;

  function save() {
    if (!form.vehicleId) return toast.error("Select a vehicle");
    if (!form.driverEmployeeId) return toast.error("Select a driver");
    addTrip({
      ...form,
      siteId: form.siteId || undefined,
    });
    setForm({ ...emptyTrip, date });
    setOpen(false);
    refresh();
    toast.success("Duty assigned");
  }

  function handleExport() {
    void exportRows(
      dayTrips.map((t) => ({
        Date: t.date, Driver: empName(t.driverEmployeeId), Vehicle: plate(t.vehicleId),
        Site: siteName(t.siteId), Route: t.route ?? "", Departure: t.departureTime ?? "",
        Return: t.returnTime ?? "", "Duty hours": hours(t.departureTime, t.returnTime),
        Passengers: t.passengers, Status: t.status,
      })),
      `driver-duty-${date}`, "Duty",
    );
  }

  return (
    <AppShell>
      <div className="w-full space-y-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Driver Duty Roster</h1>
            <p className="text-sm text-muted-foreground">Daily runs per driver — vehicle, route, timing and duty hours.</p>
          </div>
          <Button size="sm" variant="outline" className="mt-2 sm:mt-0" onClick={handleExport} disabled={dayTrips.length === 0}>
            <Download className="mr-1 h-4 w-4" /> Export
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard title="Drivers on duty" value={onDuty.toString()} icon={<Truck className="h-5 w-5" />} variant="primary" caption={`Of ${drivers.length} drivers`} compact />
          <SummaryCard title="Idle drivers" value={Math.max(0, idle).toString()} icon={<Users className="h-5 w-5" />} variant="warning" caption="No duty assigned" compact />
          <SummaryCard title="Duty hours" value={(Math.round(dutyHours * 100) / 100).toString()} icon={<Clock className="h-5 w-5" />} variant="info" caption="Total for the day" compact />
          <SummaryCard title="Workers moved" value={pax.toString()} icon={<RouteIcon className="h-5 w-5" />} variant="success" caption="Passengers today" compact />
        </div>

        {unassigned > 0 && (
          <div className="rounded-xl border border-warning/30 bg-card p-4 text-sm shadow-sm">
            {unassigned} trip(s) on {date} have no driver assigned.
          </div>
        )}

        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-wrap gap-2">
              <div>
                <Label className="text-xs text-muted-foreground">Date</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Driver</Label>
                <Select value={driverFilter} onValueChange={setDriverFilter}>
                  <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All drivers</SelectItem>
                    {drivers.map((d) => (<SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm" disabled={scopedVehicles.length === 0 || drivers.length === 0}>
                  <Plus className="mr-1 h-4 w-4" /> Assign duty
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Assign duty</DialogTitle>
                  <DialogDescription>Give a driver a vehicle and a run for the day.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Driver</Label>
                    <Select
                      value={form.driverEmployeeId}
                      onValueChange={(v) => {
                        const prof = profiles.find((p) => p.employeeId === v);
                        setForm({ ...form, driverEmployeeId: v, vehicleId: prof?.assignedVehicleId ?? form.vehicleId });
                      }}
                    >
                      <SelectTrigger><SelectValue placeholder="Select driver" /></SelectTrigger>
                      <SelectContent>
                        {drivers.map((d) => (<SelectItem key={d.id} value={d.id}>{d.name} — {d.employeeCode}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Vehicle</Label>
                    <Select value={form.vehicleId} onValueChange={(v) => setForm({ ...form, vehicleId: v })}>
                      <SelectTrigger><SelectValue placeholder="Select vehicle" /></SelectTrigger>
                      <SelectContent>
                        {scopedVehicles.map((v) => (<SelectItem key={v.id} value={v.id}>{v.plateNo} — {v.type}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Site</Label>
                    <Select value={form.siteId} onValueChange={(v) => setForm({ ...form, siteId: v })}>
                      <SelectTrigger><SelectValue placeholder="Select site" /></SelectTrigger>
                      <SelectContent>
                        {sites.map((s) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Date</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
                  <div><Label>Departure</Label><Input type="time" value={form.departureTime} onChange={(e) => setForm({ ...form, departureTime: e.target.value })} /></div>
                  <div><Label>Return</Label><Input type="time" value={form.returnTime} onChange={(e) => setForm({ ...form, returnTime: e.target.value })} /></div>
                  <div><Label>Passengers</Label><Input type="number" value={form.passengers} onChange={(e) => setForm({ ...form, passengers: Number(e.target.value) })} /></div>
                  <div><Label>Route</Label><Input value={form.route} onChange={(e) => setForm({ ...form, route: e.target.value })} placeholder="Dorm → Site" /></div>
                  <div className="sm:col-span-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button onClick={save}>Assign</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="mt-4 overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Driver</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Site / route</TableHead>
                  <TableHead>Timing</TableHead>
                  <TableHead>Duty hrs</TableHead>
                  <TableHead>Pax</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="sticky right-0 bg-card w-24 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dayTrips.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center">
                      <EmptyState className="border-0 bg-transparent" icon={<RouteIcon className="h-5 w-5" />} title="No duty for this day" description="Assign a driver to start the roster." />
                    </TableCell>
                  </TableRow>
                ) : (
                  dayTrips.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{empName(t.driverEmployeeId)}</TableCell>
                      <TableCell>{plate(t.vehicleId)}</TableCell>
                      <TableCell>
                        <div>{siteName(t.siteId)}</div>
                        <div className="text-xs text-muted-foreground">{t.route || "—"}</div>
                      </TableCell>
                      <TableCell className="text-xs">{t.departureTime || "—"} → {t.returnTime || "—"}</TableCell>
                      <TableCell>{hours(t.departureTime, t.returnTime) || "—"}</TableCell>
                      <TableCell>{t.passengers}</TableCell>
                      <TableCell>
                        <StatusBadge
                          variant={t.status === "Completed" ? "success" : t.status === "Cancelled" ? "ghost" : "warning"}
                          label={t.status}
                          dot
                        />
                      </TableCell>
                      <TableCell className="sticky right-0 bg-card">
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

        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <h2 className="text-sm font-medium text-muted-foreground">Duty hours per driver — {date}</h2>
          {perDriver.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No driver duty recorded for this date.</p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {perDriver.map((r) => (
                <span key={r.driver.id} className="rounded-full border bg-muted/40 px-3 py-1.5 text-xs font-medium">
                  {r.driver.name} · {r.trips} trip(s) · {r.hours}h
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
