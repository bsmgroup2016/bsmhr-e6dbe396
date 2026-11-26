/**
 * Automatic project/site assignment from a worker's check-in GPS.
 * Site coordinates persist on the sites row (geocoded from the address with
 * Google, refreshed after 30 days). Exactly one site in range → assignment
 * moves there; several → the worker chooses; history rows are kept (Transferred).
 */
import { serviceRest } from "@/lib/api-v1.server";
import { DEFAULT_SITE_RADIUS_M, matchSites, type SiteGeo, type SiteMatch } from "@/core/site-match";

type SiteRow = { id: string; project_id: string; name: string; location: string | null; lat: number | null; lng: number | null; geofence_radius_m: number | null; geocoded_at: string | null };
const STALE_MS = 30 * 86400_000;

export type AutoAssignResult =
  | { status: "assigned"; siteId: string; siteName: string; distanceM: number; changed: boolean }
  | { status: "choose"; candidates: Array<{ siteId: string; siteName: string; distanceM: number }> }
  | { status: "none" }
  | { status: "unavailable"; reason: string };

async function geocode(address: string): Promise<{ lat: number; lng: number } | null> {
  const key = process.env["GOOGLE_MAPS_API_KEY"];
  if (!key) return null;
  const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?region=sg&components=country:SG&address=${encodeURIComponent(address)}&key=${encodeURIComponent(key)}`);
  if (!res.ok) return null;
  const body = (await res.json()) as { status: string; results?: Array<{ geometry: { location: { lat: number; lng: number } } }> };
  const loc = body.status === "OK" ? body.results?.[0]?.geometry.location : undefined;
  return loc ? { lat: loc.lat, lng: loc.lng } : null;
}

export async function loadSiteGeos(): Promise<SiteGeo[] | { reason: string }> {
  const res = await serviceRest(`sites?select=id,project_id,name,location,lat,lng,geofence_radius_m,geocoded_at&status=eq.Active&limit=500`);
  if (!res) return { reason: "Server key missing" };
  if (!res.ok) {
    const t = await res.text();
    return { reason: t.includes("does not exist") ? "Site map locations are not set up yet (database update 0079 pending)." : "Could not load sites" };
  }
  const rows = (await res.json()) as SiteRow[];
  let budget = 20; // bound geocoding calls per check-in
  for (const r of rows) {
    const stale = !r.geocoded_at || Date.now() - Date.parse(r.geocoded_at) > STALE_MS;
    if ((r.lat == null || stale) && budget > 0 && r.location?.trim()) {
      budget--;
      const loc = await geocode(`${r.name}, ${r.location}, Singapore`).catch(() => null) ?? await geocode(`${r.location}, Singapore`).catch(() => null);
      if (loc) {
        r.lat = loc.lat; r.lng = loc.lng;
        await serviceRest(`sites?id=eq.${encodeURIComponent(r.id)}`, { method: "PATCH", prefer: "return=minimal", body: JSON.stringify({ lat: loc.lat, lng: loc.lng, geocoded_at: new Date().toISOString() }) });
      }
    }
  }
  return rows.filter((r) => r.lat != null && r.lng != null).map((r) => ({ id: r.id, projectId: r.project_id, name: r.name, lat: r.lat!, lng: r.lng!, radiusM: r.geofence_radius_m ?? DEFAULT_SITE_RADIUS_M }));
}

/** Moves the worker's current assignment to the site; previous active rows become Transferred. */
export async function assignToSite(employeeId: string, site: SiteGeo, date: string): Promise<{ changed: boolean } | null> {
  const cur = await serviceRest(`assignments?select=id,site_id,status&employee_id=eq.${encodeURIComponent(employeeId)}&status=in.(Active,Approved)`);
  if (!cur?.ok) return null;
  const rows = (await cur.json()) as Array<{ id: string; site_id: string }>;
  if (rows.length === 1 && rows[0]!.site_id === site.id) return { changed: false };
  for (const r of rows.filter((r) => r.site_id !== site.id)) {
    await serviceRest(`assignments?id=eq.${encodeURIComponent(r.id)}`, { method: "PATCH", prefer: "return=minimal", body: JSON.stringify({ status: "Transferred", end_date: date, remarks: `Auto-moved to ${site.name} from check-in location` }) });
  }
  if (rows.some((r) => r.site_id === site.id)) return { changed: true };
  const ins = await serviceRest(`assignments`, { method: "POST", prefer: "return=minimal", body: JSON.stringify({ employee_id: employeeId, site_id: site.id, project_id: site.projectId, start_date: date, status: "Active", remarks: "Auto-assigned from check-in location" }) });
  return ins?.ok ? { changed: true } : null;
}

async function setAttendanceSite(employeeId: string, date: string, siteId: string) {
  await serviceRest(`attendance?employee_id=eq.${encodeURIComponent(employeeId)}&date=eq.${date}`, { method: "PATCH", prefer: "return=minimal", body: JSON.stringify({ site_id: siteId }) });
}

export async function autoAssignFromCheckIn(employeeId: string, date: string, point: { lat: number; lng: number }): Promise<AutoAssignResult> {
  const sites = await loadSiteGeos();
  if (!Array.isArray(sites)) return { status: "unavailable", reason: sites.reason };
  const m: SiteMatch = matchSites(point, sites);
  if (m.status === "none") return { status: "none" };
  if (m.status === "multiple")
    return { status: "choose", candidates: m.candidates.map((c) => ({ siteId: c.site.id, siteName: c.site.name, distanceM: c.distanceM })) };
  const done = await assignToSite(employeeId, m.site, date);
  if (!done) return { status: "unavailable", reason: "Could not update the assignment" };
  await setAttendanceSite(employeeId, date, m.site.id);
  return { status: "assigned", siteId: m.site.id, siteName: m.site.name, distanceM: m.distanceM, changed: done.changed };
}

/** Worker picked one of several nearby sites: re-verify against today's check-in GPS. */
export async function confirmChosenSite(employeeId: string, date: string, siteId: string): Promise<AutoAssignResult> {
  const att = await serviceRest(`attendance?select=check_in_lat,check_in_lng&employee_id=eq.${encodeURIComponent(employeeId)}&date=eq.${date}&limit=1`);
  const row = att?.ok ? ((await att.json()) as Array<{ check_in_lat: number | null; check_in_lng: number | null }>)[0] : undefined;
  if (row?.check_in_lat == null || row.check_in_lng == null) return { status: "unavailable", reason: "Check in with location first" };
  const sites = await loadSiteGeos();
  if (!Array.isArray(sites)) return { status: "unavailable", reason: sites.reason };
  const m = matchSites({ lat: row.check_in_lat, lng: row.check_in_lng }, sites);
  const pick = m.status === "single" ? (m.site.id === siteId ? m : null) : m.status === "multiple" ? m.candidates.find((c) => c.site.id === siteId) ?? null : null;
  if (!pick) return { status: "unavailable", reason: "That site is not near your check-in location" };
  const done = await assignToSite(employeeId, pick.site, date);
  if (!done) return { status: "unavailable", reason: "Could not update the assignment" };
  await setAttendanceSite(employeeId, date, pick.site.id);
  return { status: "assigned", siteId: pick.site.id, siteName: pick.site.name, distanceM: pick.distanceM, changed: done.changed };
}
