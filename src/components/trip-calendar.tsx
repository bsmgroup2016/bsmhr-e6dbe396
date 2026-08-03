import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Users, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";
import type { Trip } from "@/lib/types";

interface TripCalendarProps {
  trips: Trip[];
  plate: (id: string) => string;
  siteName: (id?: string) => string;
  driverName?: (id?: string) => string;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const iso = (d: Date) => d.toISOString().slice(0, 10);
const ALL = "all";

export function TripCalendar({ trips, plate, siteName, driverName }: TripCalendarProps) {
  const now = new Date();
  const [month, setMonth] = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const [selected, setSelected] = useState<string>(iso(now));
  const [vehicleId, setVehicleId] = useState(ALL);
  const [driverId, setDriverId] = useState(ALL);
  const [route, setRoute] = useState(ALL);

  const nameOfDriver = (id?: string) => (driverName ? driverName(id) : "—");

  const vehicleOptions = useMemo(() => {
    const ids = Array.from(new Set(trips.map((t) => t.vehicleId).filter(Boolean)));
    return ids.map((id) => ({ id, label: plate(id) })).sort((a, b) => a.label.localeCompare(b.label));
  }, [trips, plate]);

  const driverOptions = useMemo(() => {
    const ids = Array.from(new Set(trips.map((t) => t.driverEmployeeId).filter(Boolean) as string[]));
    return ids.map((id) => ({ id, label: nameOfDriver(id) })).sort((a, b) => a.label.localeCompare(b.label));
  }, [trips, driverName]);

  const routeOptions = useMemo(
    () => Array.from(new Set(trips.map((t) => (t.route ?? "").trim()).filter(Boolean))).sort(),
    [trips],
  );

  const filtersActive = vehicleId !== ALL || driverId !== ALL || route !== ALL;
  const visibleTrips = trips.filter(
    (t) =>
      (vehicleId === ALL || t.vehicleId === vehicleId) &&
      (driverId === ALL || t.driverEmployeeId === driverId) &&
      (route === ALL || (t.route ?? "").trim() === route),
  );

  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const leading = (first.getDay() + 6) % 7; // Monday-first

  const byDate = new Map<string, Trip[]>();
  for (const t of visibleTrips) {
    const list = byDate.get(t.date) ?? [];
    list.push(t);
    byDate.set(t.date, list);
  }

  const cells: (string | null)[] = [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) =>
      iso(new Date(month.getFullYear(), month.getMonth(), i + 1)),
    ),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const monthTrips = cells.filter(Boolean).flatMap((d) => byDate.get(d as string) ?? []);
  const monthPax = monthTrips.reduce((s, t) => s + t.passengers, 0);
  const dayTrips = byDate.get(selected) ?? [];

  const shift = (delta: number) =>
    setMonth(new Date(month.getFullYear(), month.getMonth() + delta, 1));

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-medium text-muted-foreground">Trip calendar</h2>
          <p className="text-lg font-semibold">
            {month.toLocaleDateString("en-SG", { month: "long", year: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {monthTrips.length} trips · {monthPax} pax
          </span>
          <Button size="icon" variant="outline" onClick={() => shift(-1)} title="Previous month">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const d = new Date();
              setMonth(new Date(d.getFullYear(), d.getMonth(), 1));
              setSelected(iso(d));
            }}
          >
            Today
          </Button>
          <Button size="icon" variant="outline" onClick={() => shift(1)} title="Next month">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Select value={vehicleId} onValueChange={setVehicleId}>
          <SelectTrigger className="h-9 w-[170px]"><SelectValue placeholder="Vehicle" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All vehicles</SelectItem>
            {vehicleOptions.map((v) => (
              <SelectItem key={v.id} value={v.id}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={driverId} onValueChange={setDriverId}>
          <SelectTrigger className="h-9 w-[180px]"><SelectValue placeholder="Driver" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All drivers</SelectItem>
            {driverOptions.map((d) => (
              <SelectItem key={d.id} value={d.id}>{d.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={route} onValueChange={setRoute}>
          <SelectTrigger className="h-9 w-[200px]"><SelectValue placeholder="Route" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All routes</SelectItem>
            {routeOptions.map((r) => (
              <SelectItem key={r} value={r}>{r}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {filtersActive && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => { setVehicleId(ALL); setDriverId(ALL); setRoute(ALL); }}
          >
            <X className="mr-1 h-3.5 w-3.5" /> Clear filters
          </Button>
        )}
        <span className="text-xs text-muted-foreground">
          {visibleTrips.length} of {trips.length} trips match
        </span>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((date, i) => {
          if (!date) return <div key={`empty-${i}`} className="min-h-[84px] rounded-lg bg-muted/20" />;
          const list = byDate.get(date) ?? [];
          const pax = list.reduce((s, t) => s + t.passengers, 0);
          const isToday = date === iso(new Date());
          return (
            <button
              key={date}
              type="button"
              onClick={() => setSelected(date)}
              className={cn(
                "min-h-[84px] rounded-lg border p-1.5 text-left transition-colors hover:border-primary/60",
                selected === date ? "border-primary bg-primary/10" : "bg-background",
              )}
            >
              <div className="flex items-center justify-between">
                <span className={cn("text-xs font-semibold", isToday && "text-primary")}>
                  {Number(date.slice(8, 10))}
                </span>
                {list.length > 0 && (
                  <span className="rounded-full bg-primary/15 px-1.5 text-[10px] font-medium text-primary">
                    {list.length}
                  </span>
                )}
              </div>
              <div className="mt-1 space-y-0.5">
                {list.slice(0, 2).map((t) => (
                  <div key={t.id} className="truncate text-[10px] text-muted-foreground">
                    {t.departureTime || "--:--"} {plate(t.vehicleId)}
                  </div>
                ))}
                {list.length > 2 && (
                  <div className="text-[10px] text-muted-foreground">+{list.length - 2} more</div>
                )}
                {pax > 0 && (
                  <div className="flex items-center gap-1 text-[10px] text-foreground/70">
                    <Users className="h-2.5 w-2.5" /> {pax}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-5 rounded-lg border p-3">
        <h3 className="text-sm font-medium">
          {new Date(`${selected}T00:00:00`).toLocaleDateString("en-SG", {
            weekday: "long", day: "numeric", month: "short", year: "numeric",
          })}
        </h3>
        {dayTrips.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No trips planned for this day.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {dayTrips.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                <div>
                  <div className="font-medium">{plate(t.vehicleId)} · {siteName(t.siteId)}</div>
                  <div className="text-xs text-muted-foreground">
                    {(t.departureTime || "--:--")} → {(t.returnTime || "--:--")} · {t.route || "—"} · {t.passengers} pax
                    {driverName ? ` · Driver: ${nameOfDriver(t.driverEmployeeId)}` : ""}
                  </div>
                </div>
                <StatusBadge
                  variant={t.status === "Completed" ? "success" : t.status === "Cancelled" ? "ghost" : "warning"}
                  label={t.status}
                  dot
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}