/**
 * QR-code site attendance.
 *
 * A supervisor displays a per-site QR poster. The worker scans it with the
 * phone camera, which opens an authenticated punch page. The page captures GPS
 * and records clock-in / clock-out on the worker's own attendance row.
 *
 * The QR payload is only a routing token (site + day + checksum): it prevents
 * accidental reuse of yesterday's poster, while the real authorisation is the
 * signed-in session plus GPS capture on the punch page.
 */

export const QR_PUNCH_PATH = "/qr-punch";

export interface PunchToken {
  siteId: string;
  day: string; // YYYY-MM-DD
}

export const today = () => new Date().toISOString().slice(0, 10);

/** Small, stable checksum so a hand-edited link is rejected. */
export function punchChecksum(siteId: string, day: string): string {
  const input = `${siteId}|${day}|bsm-qr`;
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

export function buildPunchUrl(origin: string, siteId: string, day = today()): string {
  const q = new URLSearchParams({ site: siteId, d: day, k: punchChecksum(siteId, day) });
  return `${origin.replace(/\/$/, "")}${QR_PUNCH_PATH}?${q.toString()}`;
}

export type PunchValidation = { ok: true; token: PunchToken } | { ok: false; reason: string };

export function validatePunchToken(siteId?: string, day?: string, k?: string): PunchValidation {
  if (!siteId || !day || !k) {
    return { ok: false, reason: "Incomplete QR code — ask your supervisor to reprint it." };
  }
  if (punchChecksum(siteId, day) !== k) return { ok: false, reason: "This QR code is not valid." };
  if (day !== today()) {
    return { ok: false, reason: `This QR poster is dated ${day}. Today's poster is required.` };
  }
  return { ok: true, token: { siteId, day } };
}

/** Great-circle distance in metres. */
export function distanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(s)));
}

/** Hours between two HH:mm stamps, rounded to 0.25 h. */
export function hoursBetween(checkIn: string, checkOut: string): number {
  const [h1, m1] = checkIn.split(":").map(Number);
  const [h2, m2] = checkOut.split(":").map(Number);
  const mins = h2 * 60 + m2 - (h1 * 60 + m1);
  if (!Number.isFinite(mins) || mins <= 0) return 0;
  return Math.round((mins / 60) * 4) / 4;
}

export const nowTime = () => new Date().toTimeString().slice(0, 5);

/** Normal hours are capped at 8 h/day; the rest is overtime. */
export function splitHours(total: number): { normal: number; overtime: number } {
  const normal = Math.min(8, total);
  return { normal, overtime: Math.max(0, Math.round((total - normal) * 4) / 4) };
}
