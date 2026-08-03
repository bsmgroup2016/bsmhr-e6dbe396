import { useState } from "react";
import { ChevronLeft, ChevronRight, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";
import type { Trip } from "@/lib/types";

interface TripCalendarProps {
  trips: Trip[];
  plate: (id: string) => string;
  siteName: (id?: string) => string;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const iso = (d: Date) => d.toISOString().slice(0, 10);

export function TripCalendar({ trips, plate, siteName }: TripCalendarProps) {
  const now = new Date();
  const [month, setMonth] = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const [selected, setSelected] = useState<string>(iso(now));

  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const leading = (first.getDay() + 6) % 7; // Monday-first

  const byDate = new Map<string, Trip[]>();
  for (const t of trips) {
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