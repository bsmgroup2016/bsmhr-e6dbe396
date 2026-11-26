import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps, MapProviderSwitch, useMapProvider } from "@/components/map-provider";

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
  const [provider, setProvider] = useMapProvider();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ref.current || path.length === 0) return;
    let map: { remove: () => void } | null = null;
    let cancelled = false;
    setError(null);
    const fmt = (at?: string) => (at ? new Date(at).toLocaleString("en-SG", { hour12: true }) : "");
    const color = suspicious ? "#ef4444" : "#6366f1";

    (async () => {
      if (provider === "google") {
        const g = await loadGoogleMaps();
        if (cancelled || !ref.current) return;
        const el = ref.current;
        const gm = new g.maps.Map(el, { clickableIcons: false, mapTypeControl: false, streetViewControl: false });
        map = { remove: () => { el.innerHTML = ""; } };
        const pts = path.map((p) => ({ lat: p.lat, lng: p.lng }));
        const info = new g.maps.InfoWindow();
        const pop = (anchor: unknown, html: string) => { info.setContent(html); info.open({ map: gm, anchor }); };
        new g.maps.Polyline({ path: pts, map: gm, strokeColor: color, strokeWeight: 4, strokeOpacity: 0.9 });
        if (pts.length > 1) {
          new g.maps.Polyline({
            path: [pts[0], pts[pts.length - 1]], map: gm, strokeOpacity: 0,
            icons: [{ icon: { path: "M 0,-1 0,1", strokeOpacity: 0.8, strokeColor: "#94a3b8", scale: 2 }, offset: "0", repeat: "14px" }],
          });
        }
        path.forEach((p, i) => {
          if (i === 0 || i === path.length - 1) return;
          new g.maps.Marker({
            position: pts[i], map: gm,
            title: `${i + 1}. ${p.label ?? ""}${p.at ? ` · ${new Date(p.at).toLocaleTimeString("en-SG", { hour12: true })}` : ""}`,
            icon: { path: g.maps.SymbolPath.CIRCLE, scale: 3, fillColor: color, fillOpacity: 1, strokeColor: color, strokeWeight: 1 },
          });
        });
        const start = new g.maps.Marker({ position: pts[0], map: gm, label: "S" });
        start.addListener("click", () => pop(start, `Start · ${fmt(path[0]?.at)}`));
        const end = new g.maps.Marker({ position: pts[pts.length - 1], map: gm, label: "E" });
        end.addListener("click", () => pop(end, `End · ${fmt(path[path.length - 1]?.at)}`));
        stops.forEach((s) => {
          const c = new g.maps.Marker({
            position: { lat: s.lat, lng: s.lng }, map: gm,
            icon: { path: g.maps.SymbolPath.CIRCLE, scale: 11, fillColor: "#f59e0b", fillOpacity: 0.35, strokeColor: "#f59e0b", strokeWeight: 2 },
          });
          c.addListener("click", () => pop(c, `Stopped here for ${s.minutes} minutes`));
        });
        const b = new g.maps.LatLngBounds();
        pts.forEach((p) => b.extend(p));
        gm.fitBounds(b, 40);
        return;
      }
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
    })().catch((e: unknown) => { if (!cancelled) setError(e instanceof Error ? e.message : "Map failed to load."); });

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [path, stops, suspicious, provider]);

  if (!path.length) {
    return (
      <p className="rounded-md border border-dashed p-6 text-center text-xs text-muted-foreground">
        No GPS trail recorded for this trip yet.
      </p>
    );
  }
  return (
    <div>
      <MapProviderSwitch value={provider} onChange={setProvider} />
      {error && <p className="mb-1 text-xs text-destructive">{error} Switch to OpenStreetMap to continue.</p>}
      <div key={provider} ref={ref} className={className ?? "h-80 w-full rounded-md border"} />
    </div>
  );
}
