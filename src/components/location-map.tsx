import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps, MapProviderSwitch, useMapProvider } from "@/components/map-provider";

export type MapPoint = { lat: number; lng: number; label: string };

/**
 * Small map pinning attendance clock-in/out locations. Users can switch
 * between OpenStreetMap (Leaflet) and Google Maps; both load after mount.
 */
export function LocationMap({ points, className }: { points: MapPoint[]; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [provider, setProvider] = useMapProvider();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ref.current || points.length === 0) return;
    let cleanup: (() => void) | null = null;
    let cancelled = false;
    setError(null);

    (async () => {
      if (provider === "google") {
        const g = await loadGoogleMaps();
        if (cancelled || !ref.current) return;
        const map = new g.maps.Map(ref.current, { clickableIcons: false, mapTypeControl: false, streetViewControl: false });
        const bounds = new g.maps.LatLngBounds();
        const info = new g.maps.InfoWindow();
        points.forEach((p) => {
          const m = new g.maps.Marker({ position: { lat: p.lat, lng: p.lng }, map, title: p.label });
          m.addListener("click", () => { info.setContent(p.label); info.open({ map, anchor: m }); });
          bounds.extend({ lat: p.lat, lng: p.lng });
        });
        if (points.length === 1) { map.setCenter(bounds.getCenter()); map.setZoom(16); }
        else map.fitBounds(bounds, 40);
        cleanup = () => { if (ref.current) ref.current.innerHTML = ""; };
        return;
      }
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      if (cancelled || !ref.current) return;
      const instance = L.map(ref.current, { attributionControl: true });
      cleanup = () => instance.remove();
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap contributors",
      }).addTo(instance);
      const markers = points.map((p) => L.marker([p.lat, p.lng]).addTo(instance).bindPopup(p.label));
      const group = L.featureGroup(markers);
      instance.fitBounds(group.getBounds().pad(0.4), { maxZoom: 16 });
    })().catch((e: unknown) => { if (!cancelled) setError(e instanceof Error ? e.message : "Map failed to load."); });

    return () => { cancelled = true; cleanup?.(); };
  }, [points, provider]);

  if (!points.length) {
    return (
      <p className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
        Location not captured for this record.
      </p>
    );
  }
  return (
    <div>
      <MapProviderSwitch value={provider} onChange={setProvider} />
      {error && <p className="mb-1 text-xs text-destructive">{error} Switch to OpenStreetMap to continue.</p>}
      <div key={provider} ref={ref} className={className ?? "h-56 w-full rounded-md border"} />
    </div>
  );
}
