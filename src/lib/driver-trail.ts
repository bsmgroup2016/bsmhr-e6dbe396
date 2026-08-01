import { supabase } from "@/integrations/supabase/client";
import { distanceMeters } from "@/lib/qr-attendance";

export interface TrailPing {
  id: string;
  taskId: string;
  driverEmployeeId: string;
  lat: number;
  lng: number;
  status?: string | null;
  speedKmh?: number | null;
  recordedAt: string;
}

export interface IdleStop {
  lat: number;
  lng: number;
  from: string;
  to: string;
  minutes: number;
}

export interface TrailAnalysis {
  pings: TrailPing[];
  distanceKm: number;
  straightKm: number;
  detourRatio: number;
  minutes: number;
  maxSpeed: number;
  idleStops: IdleStop[];
  /** Farthest ping from the straight office→site corridor, in metres. */
  maxOffRouteM: number;
  flags: string[];
  risk: "clean" | "review" | "suspicious";
}

/** Idle = stayed inside 120 m for 15 min or more. */
const IDLE_RADIUS_M = 120;
const IDLE_MIN = 15;
/** Actual driven distance more than 1.6x the direct distance = detour. */
const DETOUR_RATIO = 1.6;
const OFF_ROUTE_M = 2500;

const mins = (a: string, b: string) =>
  Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000);

export async function listTaskPings(taskId: string): Promise<TrailPing[]> {
  const { data, error } = await supabase
    .from("driver_task_pings")
    .select("*")
    .eq("task_id", taskId)
    .order("recorded_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r['id'] as string,
    taskId: r['task_id'] as string,
    driverEmployeeId: r['driver_employee_id'] as string,
    lat: Number(r['lat']),
    lng: Number(r['lng']),
    status: (r['status'] as string) ?? null,
    speedKmh: r['speed_kmh'] == null ? null : Number(r['speed_kmh']),
    recordedAt: r['recorded_at'] as string,
  }));
}

export async function recordPing(input: {
  taskId: string;
  driverEmployeeId: string;
  lat: number;
  lng: number;
  status?: string;
}): Promise<void> {
  const { error } = await supabase.from("driver_task_pings").insert({
    task_id: input.taskId,
    driver_employee_id: input.driverEmployeeId,
    lat: input.lat,
    lng: input.lng,
    status: input.status ?? null,
    recorded_at: new Date().toISOString(),
  });
  if (error) throw error;
}

/** Perpendicular-ish distance of p from the straight line a→b, in metres. */
function offCorridorM(
  p: { lat: number; lng: number },
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const ab = distanceMeters(a, b);
  if (ab === 0) return distanceMeters(p, a);
  const ap = distanceMeters(a, p);
  const bp = distanceMeters(b, p);
  // Heron's formula → triangle height on base ab.
  const s = (ab + ap + bp) / 2;
  const area = Math.sqrt(Math.max(0, s * (s - ab) * (s - ap) * (s - bp)));
  return Math.round((2 * area) / ab);
}

export function analyseTrail(pings: TrailPing[]): TrailAnalysis {
  const empty: TrailAnalysis = {
    pings, distanceKm: 0, straightKm: 0, detourRatio: 0, minutes: 0,
    maxSpeed: 0, idleStops: [], maxOffRouteM: 0, flags: [], risk: "clean",
  };
  if (pings.length < 2) return empty;

  let metres = 0;
  for (let i = 1; i < pings.length; i += 1) metres += distanceMeters(pings[i - 1]!, pings[i]!);
  const first = pings[0]!;
  const last = pings[pings.length - 1]!;
  const straight = distanceMeters(first, last);

  // Farthest point from the outbound corridor (start → farthest waypoint).
  let farthest = first;
  let farM = 0;
  for (const p of pings) {
    const d = distanceMeters(first, p);
    if (d > farM) { farM = d; farthest = p; }
  }
  let maxOff = 0;
  for (const p of pings) maxOff = Math.max(maxOff, offCorridorM(p, first, farthest));

  // Idle clusters.
  const idleStops: IdleStop[] = [];
  let i = 0;
  while (i < pings.length) {
    let j = i + 1;
    while (j < pings.length && distanceMeters(pings[i]!, pings[j]!) <= IDLE_RADIUS_M) j += 1;
    const m = mins(pings[i]!.recordedAt, pings[j - 1]!.recordedAt);
    if (j - 1 > i && m >= IDLE_MIN) {
      idleStops.push({
        lat: pings[i]!.lat, lng: pings[i]!.lng,
        from: pings[i]!.recordedAt, to: pings[j - 1]!.recordedAt, minutes: m,
      });
      i = j;
    } else {
      i += 1;
    }
  }

  const distanceKm = Math.round((metres / 1000) * 10) / 10;
  const straightKm = Math.round((straight / 1000) * 10) / 10;
  const totalMin = mins(first.recordedAt, last.recordedAt);
  const maxSpeed = Math.max(0, ...pings.map((p) => p.speedKmh ?? 0));
  // A return trip ends where it started, so compare against the farthest leg.
  const baseline = Math.max(straight, farM * 2);
  const detourRatio = baseline > 0 ? Math.round((metres / baseline) * 100) / 100 : 0;

  const flags: string[] = [];
  if (detourRatio >= DETOUR_RATIO) {
    flags.push(`Drove ${distanceKm} km where ${Math.round((baseline / 1000) * 10) / 10} km was expected (${detourRatio}x)`);
  }
  if (maxOff >= OFF_ROUTE_M) flags.push(`Went ${(maxOff / 1000).toFixed(1)} km away from the expected route`);
  for (const s of idleStops) flags.push(`Stopped ${s.minutes} min at ${s.lat.toFixed(4)}, ${s.lng.toFixed(4)}`);
  if (maxSpeed >= 90) flags.push(`Over-speeding recorded — ${maxSpeed} km/h`);

  const risk: TrailAnalysis["risk"] =
    flags.length === 0 ? "clean" : flags.length >= 2 || detourRatio >= DETOUR_RATIO ? "suspicious" : "review";

  return { pings, distanceKm, straightKm, detourRatio, minutes: totalMin, maxSpeed, idleStops, maxOffRouteM: maxOff, flags, risk };
}
