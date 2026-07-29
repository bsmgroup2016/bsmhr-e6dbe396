/**
 * Browser geolocation + OpenStreetMap Nominatim reverse geocoding.
 * Nominatim allows ~1 request/second, so lookups are queued and cached.
 */

export type GeoPoint = { lat: number; lng: number; address?: string };

const cache = new Map<string, string>();
let lastCall = 0;
let chain: Promise<unknown> = Promise.resolve();

const key = (lat: number, lng: number) => `${lat.toFixed(4)},${lng.toFixed(4)}`;

export function getCurrentPosition(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Geolocation not supported"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(new Error(err.message || "Location unavailable")),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  });
}

/** Reverse geocode with cache + 1 req/sec throttle (Nominatim usage policy). */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const k = key(lat, lng);
  const hit = cache.get(k);
  if (hit) return hit;

  const run = async (): Promise<string> => {
    const wait = Math.max(0, 1100 - (Date.now() - lastCall));
    if (wait) await new Promise((r) => setTimeout(r, wait));
    lastCall = Date.now();
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
        { headers: { Accept: "application/json" } },
      );
      if (!res.ok) throw new Error("lookup failed");
      const json = (await res.json()) as { display_name?: string };
      const address = json.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      cache.set(k, address);
      return address;
    } catch {
      const fallback = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      cache.set(k, fallback);
      return fallback;
    }
  };

  const next = chain.then(run, run) as Promise<string>;
  chain = next.catch(() => undefined);
  return next;
}

/** Capture location for a clock-in/out. Never throws — returns null when denied. */
export async function capturePoint(): Promise<GeoPoint | null> {
  try {
    const { lat, lng } = await getCurrentPosition();
    const address = await reverseGeocode(lat, lng);
    return { lat, lng, address };
  } catch {
    return null;
  }
}

export function osmEmbedUrl(lat: number, lng: number, zoom = 0.01) {
  const bbox = [lng - zoom, lat - zoom / 2, lng + zoom, lat + zoom / 2].join("%2C");
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lng}`;
}

export function osmLink(lat: number, lng: number) {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`;
}