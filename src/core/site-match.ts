/** Pure GPS → site matching used by automatic check-in assignment. */
export type SiteGeo = { id: string; projectId: string; name: string; lat: number; lng: number; radiusM: number };
export type SiteMatch =
  | { status: "single"; site: SiteGeo; distanceM: number }
  | { status: "multiple"; candidates: Array<{ site: SiteGeo; distanceM: number }> }
  | { status: "none" };

export const DEFAULT_SITE_RADIUS_M = 500;

export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

/** Sites whose radius contains the point; exactly one → auto assign, several → worker chooses. */
export function matchSites(point: { lat: number; lng: number }, sites: SiteGeo[]): SiteMatch {
  const inside = sites
    .map((site) => ({ site, distanceM: distanceMeters(point, site) }))
    .filter((m) => m.distanceM <= (m.site.radiusM || DEFAULT_SITE_RADIUS_M))
    .sort((a, b) => a.distanceM - b.distanceM);
  if (inside.length === 0) return { status: "none" };
  if (inside.length === 1) return { status: "single", site: inside[0]!.site, distanceM: inside[0]!.distanceM };
  return { status: "multiple", candidates: inside };
}
