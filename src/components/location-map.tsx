import { useEffect, useRef } from "react";

export type MapPoint = { lat: number; lng: number; label: string };

/**
 * Small OpenStreetMap (Leaflet) map pinning attendance clock-in/out locations.
 * Leaflet is browser-only, so it is imported dynamically after mount.
 */
export function LocationMap({ points, className }: { points: MapPoint[]; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current || points.length === 0) return;
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
      const markers = points.map((p) =>
        L.marker([p.lat, p.lng]).addTo(instance).bindPopup(p.label),
      );
      const group = L.featureGroup(markers);
      instance.fitBounds(group.getBounds().pad(0.4), { maxZoom: 16 });
    })();

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [points]);

  if (!points.length) {
    return (
      <p className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
        Location not captured for this record.
      </p>
    );
  }
  return <div ref={ref} className={className ?? "h-56 w-full rounded-md border"} />;
}