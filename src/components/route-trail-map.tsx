import { useEffect, useRef } from "react";

export type TrailPoint = { lat: number; lng: number; label?: string; at?: string };
export type TrailStop = { lat: number; lng: number; minutes: number };

/**
 * Draws the driver's actual GPS route (breadcrumb polyline) with start/end
 * markers, idle-stop markers and a dashed straight line for the expected path.
 * Leaflet is browser-only, so it is imported after mount.
 */
export function RouteTrailMap({
  path,
  stops = [],
  suspicious = false,
  className,
}: {
  path: TrailPoint[];
  stops?: TrailStop[];
  suspicious?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current || path.length === 0) return;
    let map: { remove: () => void } | null = null;
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      if (cancelled || !ref.current) return;
      const instance = L.map(ref.current, { attributionControl: true });
      map = instance;
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap contributors",
      }).addTo(instance);

      const latlngs = path.map((p) => [p.lat, p.lng] as [number, number]);
      const line = L.polyline(latlngs, {
        color: suspicious ? "#ef4444" : "#6366f1",
        weight: 4,
        opacity: 0.9,
      }).addTo(instance);

      // Expected direct path (start → end) for visual comparison.
      if (latlngs.length > 1) {
        L.polyline([latlngs[0]!, latlngs[latlngs.length - 1]!], {
          color: "#94a3b8",
          weight: 2,
          dashArray: "6 8",
          opacity: 0.8,
        }).addTo(instance);
      }

      // Direction breadcrumbs.
      path.forEach((p, i) => {
        if (i === 0 || i === path.length - 1) return;
        L.circleMarker([p.lat, p.lng], {
          radius: 3,
          color: suspicious ? "#ef4444" : "#6366f1",
          fillOpacity: 1,
        })
          .addTo(instance)
          .bindTooltip(
            `${i + 1}. ${p.label ?? ""}${p.at ? ` · ${new Date(p.at).toLocaleTimeString("en-SG", { hour12: true })}` : ""}`,
          );
      });

      L.marker(latlngs[0]!).addTo(instance).bindPopup(`Start · ${path[0]?.at ? new Date(path[0].at).toLocaleString("en-SG", { hour12: true }) : ""}`);
      L.marker(latlngs[latlngs.length - 1]!)
        .addTo(instance)
        .bindPopup(`End · ${path[path.length - 1]?.at ? new Date(path[path.length - 1]!.at!).toLocaleString("en-SG", { hour12: true }) : ""}`);

      stops.forEach((s) => {
        L.circleMarker([s.lat, s.lng], {
          radius: 11,
          color: "#f59e0b",
          fillColor: "#f59e0b",
          fillOpacity: 0.35,
          weight: 2,
        })
          .addTo(instance)
          .bindPopup(`Stopped here for ${s.minutes} minutes`);
      });

      instance.fitBounds(line.getBounds().pad(0.25));
    })();

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [path, stops, suspicious]);

  if (!path.length) {
    return (
      <p className="rounded-md border border-dashed p-6 text-center text-xs text-muted-foreground">
        No GPS trail recorded for this trip yet.
      </p>
    );
  }
  return <div ref={ref} className={className ?? "h-80 w-full rounded-md border"} />;
}
