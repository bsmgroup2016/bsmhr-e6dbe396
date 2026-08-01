import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Bell, History, MapPin, Plane, Plus, RefreshCw, Route as RouteIcon, Send, ShieldCheck, Smartphone, Trash2, Truck } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { LocationMap, type MapPoint } from "@/components/location-map";
import { RouteTrailMap } from "@/components/route-trail-map";
import { getEmployees, getVehicles, getSites, getCurrentCompany, getDriverProfiles } from "@/lib/store";
import { isDriver } from "@/lib/workforce-split";
import { capturePoint } from "@/lib/geo";
import {
  createDriverTask, deleteDriverTask, driverAvailability, listDriverTasks, minutesAgo, nextStatus,
  pushDriverLocation, statusTone, updateTaskStatus, TASK_TYPES, type DriverTask, type TaskType,
} from "@/lib/driver-tasks";
import {
  analyseTrail, listPingsForTasks, recordPing, splitLegs, type TrailAnalysis, type TrailPing,
} from "@/lib/driver-trail";

export const Route = createFileRoute("/_authenticated/driver-dispatch")({
  head: () => ({
    meta: [
      { title: "Driver Dispatch & Live Tracking — BSM Workforce" },
      { name: "description", content: "HR dispatches driver instructions, drivers update trip status from their phone and share live GPS location on the map." },
      { property: "og:title", content: "Driver Dispatch & Live Tracking — BSM Workforce" },
      { property: "og:description", content: "Assign driver tasks, track status updates and live driver location." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DriverDispatchPage,
});

const nowLocal = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

function DriverDispatchPage() {
  const companyId = getCurrentCompany();
  const employees = getEmployees();
  const vehicles = getVehicles();
  const sites = getSites();
  const driverProfiles = getDriverProfiles();

  const drivers = useMemo(
    () => employees.filter((e) => isDriver(e) && (!companyId || !e.companyId || e.companyId === companyId)),
    [employees, companyId],
  );

  const [tasks, setTasks] = useState<DriverTask[]>([]);
  const [trails, setTrails] = useState<Record<string, TrailPing[]>>({});
  const [replayId, setReplayId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [actor, setActor] = useState("");
  const [note, setNote] = useState("");
  const [form, setForm] = useState({
    driverEmployeeId: "", vehicleId: "", siteId: "", title: "Worker transport",
    taskType: "Worker transport" as TaskType, flightNo: "", terminal: "", arrivingWorkers: "",
    expectedMinutes: 60,
    instruction: "", pickup: "", dropoff: "", passengers: 0, scheduledAt: nowLocal(),
  });

  const reload = async () => {
    try {
      const list = await listDriverTasks();
      setTasks(list);
      setTrails(await listPingsForTasks(list.map((t) => t.id)));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load tasks");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
    const t = setInterval(() => void reload(), 20000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!actor && drivers.length) setActor(drivers[0]!.id);
  }, [drivers, actor]);

  const driverIds = new Set(drivers.map((d) => d.id));
  const scoped = tasks.filter((t) => driverIds.has(t.driverEmployeeId));
  const name = (id: string) => employees.find((e) => e.id === id)?.name ?? "—";
  const plate = (id?: string | null) => (id ? vehicles.find((v) => v.id === id)?.plateNo ?? "—" : "—");
  const siteName = (id?: string | null) => (id ? sites.find((s) => s.id === id)?.name ?? "—" : "—");

  const active = scoped.filter((t) => t.status !== "Back at office" && t.status !== "Cancelled");
  const doneToday = scoped.filter((t) => t.status === "Back at office").length;
  const pending = scoped.filter((t) => t.status === "Assigned").length;

  const analyses = useMemo(() => {
    const out: Record<string, TrailAnalysis> = {};
    for (const t of tasks) out[t.id] = analyseTrail(trails[t.id] ?? []);
    return out;
  }, [tasks, trails]);
  const flagged = scoped.filter((t) => analyses[t.id]?.risk === "suspicious");
  const replayTask = scoped.find((t) => t.id === replayId) ?? null;
  const replay = replayTask ? analyses[replayTask.id] : undefined;
  const replayLegs = replay ? splitLegs(replay.pings, replay.idleStops) : [];

  const [historyDriver, setHistoryDriver] = useState("all");
  const [historyFrom, setHistoryFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [historyTo, setHistoryTo] = useState(() => new Date().toISOString().slice(0, 10));

  const history = scoped
    .filter((t) => historyDriver === "all" || t.driverEmployeeId === historyDriver)
    .filter((t) => {
      const day = t.scheduledAt.slice(0, 10);
      return day >= historyFrom && day <= historyTo;
    })
    .slice()
    .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt));
  const clock = (iso: string) => new Date(iso).toLocaleTimeString("en-SG", { hour: "2-digit", minute: "2-digit", hour12: true });

  const points: MapPoint[] = scoped
    .filter((t) => t.lastLat != null && t.lastLng != null)
    .map((t) => ({
      lat: t.lastLat as number,
      lng: t.lastLng as number,
      label: `${name(t.driverEmployeeId)} · ${plate(t.vehicleId)}<br/>${t.status} · ${minutesAgo(t.lastLocationAt) ?? "?"} min ago`,
    }));

  async function save() {
    if (!form.driverEmployeeId) return toast.error("Select a driver");
    if (!form.instruction.trim()) return toast.error("Write the instruction for the driver");
    try {
      const driver = drivers.find((d) => d.id === form.driverEmployeeId);
      await createDriverTask({
        ...form,
        companyId: driver?.companyId ?? null,
        scheduledAt: new Date(form.scheduledAt).toISOString(),
      });
      setOpen(false);
      setForm({ ...form, instruction: "", pickup: "", dropoff: "", passengers: 0 });
      await reload();
      toast.success(`Instruction sent to ${driver?.name ?? "driver"} — push notification delivered to his phone`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send instruction");
    }
  }

  async function advance(task: DriverTask) {
    const next = nextStatus(task.status);
    if (!next) return;
    const loc = await capturePoint();
    await updateTaskStatus(task.id, next, {
      note: note || task.driverNote || undefined,
      ...(loc ? { lat: loc.lat, lng: loc.lng } : {}),
    });
    if (loc) {
      await recordPing({
        taskId: task.id, driverEmployeeId: task.driverEmployeeId,
        lat: loc.lat, lng: loc.lng, status: next,
      });
    }
    setNote("");
    await reload();
    toast.success(`Status updated: ${next}${loc ? " · location shared" : ""}`);
  }

  async function shareLocation(task: DriverTask) {
    const loc = await capturePoint();
    if (!loc) return toast.error("Location permission denied on this phone");
    await pushDriverLocation(task.id, loc.lat, loc.lng);
    await recordPing({
      taskId: task.id, driverEmployeeId: task.driverEmployeeId,
      lat: loc.lat, lng: loc.lng, status: task.status,
    });
    await reload();
    toast.success(`Live location sent — ${loc.address}`);
  }

  const actorTasks = scoped.filter((t) => t.driverEmployeeId === actor);

  return (
    <AppShell>
      <div className="w-full space-y-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Driver Dispatch &amp; Live Tracking</h1>
            <p className="text-sm text-muted-foreground">
              HR sends the instruction, the driver sees it on his phone, updates status and shares GPS — all live on the map below.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => void reload()}>
            <RefreshCw className="mr-1 h-4 w-4" /> Refresh
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard title="Active tasks" value={active.length.toString()} icon={<Truck className="h-5 w-5" />} variant="primary" caption="On the road now" compact />
          <SummaryCard title="Waiting acceptance" value={pending.toString()} icon={<Bell className="h-5 w-5" />} variant="warning" caption="Driver not accepted yet" compact />
          <SummaryCard title="Completed" value={doneToday.toString()} icon={<Send className="h-5 w-5" />} variant="success" caption="Back at office" compact />
          <SummaryCard title="Route alerts" value={flagged.length.toString()} icon={<AlertTriangle className="h-5 w-5" />} variant={flagged.length ? "destructive" : "info"} caption="Detour / long stop detected" compact />
        </div>

        <Tabs defaultValue="board">
          <TabsList>
            <TabsTrigger value="board">Dispatch board (HR)</TabsTrigger>
            <TabsTrigger value="phone">
              <Smartphone className="mr-1 h-4 w-4" /> Driver app (demo)
            </TabsTrigger>
            <TabsTrigger value="history">
              <History className="mr-1 h-4 w-4" /> Trip history
            </TabsTrigger>
          </TabsList>

          <TabsContent value="board" className="space-y-4">
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-medium text-muted-foreground">Instructions &amp; live status</h2>
                <Dialog open={open} onOpenChange={setOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" disabled={drivers.length === 0}>
                      <Plus className="mr-1 h-4 w-4" /> New instruction
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Send instruction to driver</DialogTitle>
                      <DialogDescription>The driver receives this as a task with a push notification on his phone.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <Label>Driver</Label>
                        <Select value={form.driverEmployeeId} onValueChange={(v) => setForm({ ...form, driverEmployeeId: v })}>
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
                            {vehicles.map((v) => (<SelectItem key={v.id} value={v.id}>{v.plateNo} — {v.type}</SelectItem>))}
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
                      <div><Label>Task title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
                      <div><Label>Pickup point</Label><Input value={form.pickup} onChange={(e) => setForm({ ...form, pickup: e.target.value })} placeholder="Kaki Bukit Dorm" /></div>
                      <div><Label>Drop-off point</Label><Input value={form.dropoff} onChange={(e) => setForm({ ...form, dropoff: e.target.value })} placeholder="Site Gate B" /></div>
                      <div><Label>Passengers</Label><Input type="number" value={form.passengers} onChange={(e) => setForm({ ...form, passengers: Number(e.target.value) })} /></div>
                      <div><Label>Schedule</Label><Input type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} /></div>
                      <div className="sm:col-span-2">
                        <Label>Instruction</Label>
                        <Textarea rows={3} value={form.instruction} onChange={(e) => setForm({ ...form, instruction: e.target.value })} placeholder="Pick 14 workers from the dorm and drop at site gate B by 7:30 AM." />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                      <Button onClick={() => void save()}><Send className="mr-1 h-4 w-4" /> Send</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              {loading ? (
                <p className="mt-4 text-sm text-muted-foreground">Loading tasks…</p>
              ) : scoped.length === 0 ? (
                <EmptyState className="mt-4" icon={<Truck className="h-5 w-5" />} title="No driver instruction yet" description="Send the first instruction to a driver." />
              ) : (
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  {scoped.map((t) => (
                    <div key={t.id} className="rounded-lg border bg-muted/20 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{t.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {name(t.driverEmployeeId)} · {plate(t.vehicleId)} · {siteName(t.siteId)}
                          </p>
                        </div>
                        <StatusBadge variant={statusTone(t.status)} label={t.status} dot />
                      </div>
                      {analyses[t.id] && analyses[t.id]!.pings.length > 1 ? (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <StatusBadge
                            variant={analyses[t.id]!.risk === "suspicious" ? "destructive" : analyses[t.id]!.risk === "review" ? "warning" : "success"}
                            label={
                              analyses[t.id]!.risk === "suspicious" ? "Unusual route" :
                              analyses[t.id]!.risk === "review" ? "Needs review" : "Route normal"
                            }
                            dot
                          />
                          <span className="text-xs text-muted-foreground">
                            {analyses[t.id]!.distanceKm} km driven · {analyses[t.id]!.minutes} min · {analyses[t.id]!.idleStops.length} long stop(s)
                          </span>
                        </div>
                      ) : null}
                      <p className="mt-2 text-sm">{t.instruction}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t.pickup || "—"} → {t.dropoff || "—"} · {t.passengers} pax ·{" "}
                        {new Date(t.scheduledAt).toLocaleString("en-SG", { hour12: true })}
                      </p>
                      {t.driverNote ? <p className="mt-1 text-xs italic text-muted-foreground">Driver: “{t.driverNote}”</p> : null}
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <span className="text-xs text-muted-foreground">
                          {t.lastLocationAt ? `GPS ${minutesAgo(t.lastLocationAt)} min ago` : "No GPS ping yet"}
                        </span>
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="outline" onClick={() => setReplayId(t.id)}>
                            <RouteIcon className="mr-1 h-4 w-4" /> Route replay
                          </Button>
                          <Button size="icon" variant="ghost" title="Delete task" onClick={() => void deleteDriverTask(t.id).then(reload)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <h2 className="text-sm font-medium text-muted-foreground">Live driver location (OpenStreetMap — no Google API key needed)</h2>
              <div className="mt-3">
                <LocationMap points={points} className="h-80 w-full rounded-md border" />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="phone">
            <div className="mx-auto w-full max-w-sm rounded-[2rem] border-4 border-muted bg-card p-4 shadow-lg">
              <div className="mb-3">
                <Label className="text-xs text-muted-foreground">Signed in as driver</Label>
                <Select value={actor} onValueChange={setActor}>
                  <SelectTrigger><SelectValue placeholder="Select driver" /></SelectTrigger>
                  <SelectContent>
                    {drivers.map((d) => (<SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              {actorTasks.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No task assigned. Enjoy the break 🚐</p>
              ) : (
                <div className="space-y-3">
                  {actorTasks.map((t) => (
                    <div key={t.id} className="rounded-xl border p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium">{t.title}</p>
                        <StatusBadge variant={statusTone(t.status)} label={t.status} dot />
                      </div>
                      <p className="mt-1 text-sm">{t.instruction}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{t.pickup || "—"} → {t.dropoff || "—"} · {t.passengers} pax</p>
                      <div className="mt-3 space-y-2">
                        <Textarea rows={2} placeholder="Add a note for HR (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
                        <div className="flex flex-wrap gap-2">
                          {nextStatus(t.status) ? (
                            <Button size="sm" className="flex-1" onClick={() => void advance(t)}>
                              {nextStatus(t.status)}
                            </Button>
                          ) : (
                            <Button size="sm" className="flex-1" disabled>Trip finished</Button>
                          )}
                          <Button size="sm" variant="outline" onClick={() => void shareLocation(t)}>
                            <MapPin className="mr-1 h-4 w-4" /> Share location
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <p className="mt-4 text-center text-[11px] text-muted-foreground">
                Demo of the driver phone view. On his own phone the driver signs in and must allow location access.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-48">
                  <Label className="text-xs text-muted-foreground">Driver</Label>
                  <Select value={historyDriver} onValueChange={setHistoryDriver}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All drivers</SelectItem>
                      {drivers.map((d) => (<SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">From</Label>
                  <Input type="date" value={historyFrom} onChange={(e) => setHistoryFrom(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">To</Label>
                  <Input type="date" value={historyTo} onChange={(e) => setHistoryTo(e.target.value)} />
                </div>
              </div>

              {history.length === 0 ? (
                <EmptyState className="mt-4" icon={<History className="h-5 w-5" />} title="No trip in this period" description="Change the driver or date range." />
              ) : (
                <div className="mt-4 space-y-3">
                  {history.map((t) => {
                    const a = analyses[t.id];
                    const legs = a ? splitLegs(a.pings, a.idleStops) : [];
                    return (
                      <div key={t.id} className="rounded-lg border bg-muted/20 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate font-medium">{t.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(t.scheduledAt).toLocaleDateString("en-SG")} · {name(t.driverEmployeeId)} · {plate(t.vehicleId)} · {t.pickup || "—"} → {t.dropoff || "—"}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <StatusBadge variant={statusTone(t.status)} label={t.status} dot />
                            <Button size="sm" variant="outline" onClick={() => setReplayId(t.id)}>
                              <RouteIcon className="mr-1 h-4 w-4" /> Map replay
                            </Button>
                          </div>
                        </div>

                        {legs.length ? (
                          <ol className="mt-3 space-y-2 border-l pl-4">
                            {legs.map((leg, i) => (
                              <li key={`${t.id}-${i}`} className="relative text-xs">
                                <span className="absolute -left-[21px] top-1 h-2 w-2 rounded-full bg-primary" />
                                <p className="font-medium">{leg.label}</p>
                                <p className="text-muted-foreground">
                                  {clock(leg.from)} → {clock(leg.to)} · {leg.minutes} min · {leg.distanceKm} km
                                </p>
                                {leg.stops.map((s) => (
                                  <p key={s.from} className="text-warning">
                                    Stopped {s.minutes} min here ({s.lat.toFixed(4)}, {s.lng.toFixed(4)})
                                  </p>
                                ))}
                              </li>
                            ))}
                          </ol>
                        ) : (
                          <p className="mt-3 text-xs text-muted-foreground">No GPS trail recorded for this trip.</p>
                        )}

                        {a && a.pings.length > 1 ? (
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <StatusBadge
                              variant={a.risk === "suspicious" ? "destructive" : a.risk === "review" ? "warning" : "success"}
                              label={a.risk === "suspicious" ? "Unusual route" : a.risk === "review" ? "Needs review" : "Route normal"}
                              dot
                            />
                            <span className="text-xs text-muted-foreground">
                              Total {a.distanceKm} km · {a.minutes} min · detour {a.detourRatio}x
                            </span>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <Dialog open={!!replayTask} onOpenChange={(o) => !o && setReplayId(null)}>
          <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Route replay — {replayTask?.title}</DialogTitle>
              <DialogDescription>
                {replayTask ? `${name(replayTask.driverEmployeeId)} · ${plate(replayTask.vehicleId)} · ${replayTask.pickup || "—"} → ${replayTask.dropoff || "—"}` : ""}
              </DialogDescription>
            </DialogHeader>

            {replay && replay.pings.length > 1 ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    ["Distance driven", `${replay.distanceKm} km`],
                    ["Trip time", `${replay.minutes} min`],
                    ["Detour factor", `${replay.detourRatio}x`],
                    ["Long stops", `${replay.idleStops.length}`],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-lg border bg-muted/20 p-3">
                      <p className="text-xs text-muted-foreground">{k}</p>
                      <p className="text-sm font-semibold">{v}</p>
                    </div>
                  ))}
                </div>

                <RouteTrailMap
                  path={replay.pings.map((p) => ({ lat: p.lat, lng: p.lng, label: p.status ?? "", at: p.recordedAt }))}
                  stops={replay.idleStops.map((s) => ({ lat: s.lat, lng: s.lng, minutes: s.minutes }))}
                  suspicious={replay.risk === "suspicious"}
                  className="h-80 w-full rounded-md border"
                />
                <p className="text-[11px] text-muted-foreground">
                  Solid line = the road the driver actually took. Dashed grey line = direct expected path. Amber circle = vehicle stopped there.
                </p>

                {replay.flags.length ? (
                  <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3">
                    <p className="flex items-center gap-1 text-sm font-medium text-destructive">
                      <AlertTriangle className="h-4 w-4" /> Unusual activity detected
                    </p>
                    <ul className="mt-1 list-inside list-disc text-xs text-muted-foreground">
                      {replay.flags.map((f) => (<li key={f}>{f}</li>))}
                    </ul>
                  </div>
                ) : (
                  <p className="flex items-center gap-1 rounded-lg border border-success/40 bg-success/5 p-3 text-sm text-success">
                    <ShieldCheck className="h-4 w-4" /> Route looks normal — no detour or unexplained stop.
                  </p>
                )}

                <div className="rounded-lg border">
                  <p className="border-b px-3 py-2 text-xs font-medium text-muted-foreground">GPS timeline</p>
                  {replayLegs.length ? (
                    <ol className="divide-y">
                      {replayLegs.map((leg, i) => (
                        <li key={`leg-${i}`} className="px-3 py-2 text-xs">
                          <p className="font-medium">{i + 1}. {leg.label}</p>
                          <p className="text-muted-foreground">
                            {clock(leg.from)} → {clock(leg.to)} · {leg.minutes} min · {leg.distanceKm} km
                          </p>
                          {leg.stops.map((s) => (
                            <p key={s.from} className="text-warning">Stopped {s.minutes} min at {s.lat.toFixed(4)}, {s.lng.toFixed(4)}</p>
                          ))}
                        </li>
                      ))}
                    </ol>
                  ) : null}
                  <p className="border-y bg-muted/30 px-3 py-2 text-xs font-medium text-muted-foreground">Raw GPS pings</p>
                  <div className="max-h-56 overflow-y-auto divide-y">
                    {replay.pings.map((p, i) => (
                      <div key={p.id} className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs">
                        <span className="text-muted-foreground">
                          {i + 1}. {new Date(p.recordedAt).toLocaleString("en-SG", { hour12: true })}
                        </span>
                        <span className="truncate">{p.status ?? "—"}</span>
                        <span className="shrink-0 text-muted-foreground">
                          {p.lat.toFixed(4)}, {p.lng.toFixed(4)}{p.speedKmh != null ? ` · ${p.speedKmh} km/h` : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <EmptyState icon={<RouteIcon className="h-5 w-5" />} title="No GPS trail yet" description="The trail builds up as the driver shares location or updates trip status from his phone." />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
