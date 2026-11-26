import { useEffect, useState } from "react";
import { getGoogleMapsKey } from "@/lib/maps-key.functions";

export type MapProvider = "osm" | "google";
const STORAGE = "map-provider";
const EVENT = "map-provider-change";

/** Shared map provider choice (OpenStreetMap or Google), remembered in this browser. */
export function useMapProvider(): [MapProvider, (p: MapProvider) => void] {
  const [provider, setProvider] = useState<MapProvider>("osm");
  useEffect(() => {
    const read = () => setProvider(localStorage.getItem(STORAGE) === "google" ? "google" : "osm");
    read();
    window.addEventListener(EVENT, read);
    return () => window.removeEventListener(EVENT, read);
  }, []);
  const set = (p: MapProvider) => {
    localStorage.setItem(STORAGE, p);
    window.dispatchEvent(new Event(EVENT));
  };
  return [provider, set];
}

export function MapProviderSwitch({ value, onChange }: { value: MapProvider; onChange: (p: MapProvider) => void }) {
  const btn = (p: MapProvider, label: string) => (
    <button
      type="button"
      onClick={() => onChange(p)}
      aria-pressed={value === p}
      className={`rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
        value === p ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
  return (
    <div className="mb-1.5 flex justify-end">
      <div className="inline-flex gap-0.5 rounded-md border bg-card p-0.5" role="group" aria-label="Map provider">
        {btn("osm", "OpenStreetMap")}
        {btn("google", "Google Maps")}
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type GoogleNS = any;
let loading: Promise<GoogleNS> | null = null;

/** Loads the Maps JavaScript API once (async + callback). */
export function loadGoogleMaps(): Promise<GoogleNS> {
  const w = window as unknown as Record<string, unknown> & { google?: { maps?: unknown } };
  if (w.google?.maps) return Promise.resolve(w.google);
  if (loading) return loading;
  loading = (async () => {
    const { key } = await getGoogleMapsKey();
    if (!key) throw new Error("Google Maps key is not configured.");
    await new Promise<void>((resolve, reject) => {
      w["__initGoogleMaps"] = () => resolve();
      const s = document.createElement("script");
      s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&loading=async&callback=__initGoogleMaps&region=SG&language=en`;
      s.async = true;
      s.onerror = () => reject(new Error("Google Maps failed to load."));
      document.head.appendChild(s);
    });
    return w.google;
  })().catch((e) => {
    loading = null;
    throw e;
  });
  return loading;
}
