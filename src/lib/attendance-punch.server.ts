import { TABLE_COLUMNS, UNAVAILABLE_TABLES } from "@/core/data-tables";
/**
 * Shared punch application used by both the single punch endpoint and the
 * offline batch sync endpoint.
 *
 * Idempotency contract: the client sends a stable `clientEventId` per punch.
 * The punch is first claimed in `attendance_events` (unique per employee +
 * clientEventId); a duplicate claim short-circuits, so replaying a queued
 * punch after regaining signal never creates a second attendance row.
 */
import { fromAttendance } from "@/lib/db";
import { sbRest, sbSelect, serviceRest, type AuthContext } from "@/lib/api-v1.server";
import { verifyPunch, type PunchVerdict } from "@/lib/punch-verification";

export interface PunchEvent {
  clientEventId?: string;
  employeeId?: string;
  date?: string;
  status?: string;
  checkIn?: string;
  checkOut?: string;
  /** ISO time the punch actually happened on the device (offline-safe). */
  punchedAt?: string;
  siteId?: string;
  hoursWorked?: number;
  overtimeHours?: number;
  lat?: number;
  lng?: number;
  /** GPS accuracy in metres reported by the device. */
  accuracyM?: number;
  /** Storage key of the selfie uploaded via POST /v1/uploads. */
  selfieKey?: string;
  address?: string;
  notes?: string;
}

export type PunchOutcome = {
  clientEventId: string | null;
  status: "saved" | "duplicate" | "error" | "rejected";
  message?: string;
  attendance?: unknown;
  verdict?: PunchVerdict;
};

const timeOf = (iso?: string) =>
  iso && !Number.isNaN(Date.parse(iso))
    ? new Date(iso).toISOString().slice(11, 16)
    : new Date().toISOString().slice(11, 16);

export async function applyPunch(
  ctx: AuthContext,
  event: PunchEvent,
  employeeId: string,
  source = "mobile",
): Promise<PunchOutcome> {
  const clientEventId = event.clientEventId?.trim() || null;
  // Direct portal punches use the existing daily attendance row. Queued/QR
  // punches still require the event table for their replay/proof contract.
  const directPunch = source === "single" && !clientEventId && !event.siteId && !event.selfieKey;
  if (UNAVAILABLE_TABLES.has("attendance_events") && !directPunch)
    return { clientEventId, status: "error", message: "QR/mobile attendance punches are unavailable: attendance_events is not present in the connected database. Use manual attendance instead." };
  const date =
    event.date ??
    (event.punchedAt && !Number.isNaN(Date.parse(event.punchedAt))
      ? new Date(event.punchedAt).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
    return { clientEventId, status: "error", message: "date must be YYYY-MM-DD" };

  // 0. Selfie + GPS verification against the site geofence.
  let siteGeo:
    | {
        lat: number | null;
        lng: number | null;
        geofence_radius_m: number | null;
        geofence_enforced: boolean | null;
        selfie_required: boolean | null;
      }
    | undefined;
  if (event.siteId) {
    const sites = await sbSelect<typeof siteGeo & object>(
      ctx,
      `sites?select=lat,lng,geofence_radius_m,geofence_enforced,selfie_required&id=eq.${encodeURIComponent(event.siteId)}&limit=1`,
    ).catch(() => []);
    siteGeo = sites[0];
  }
  const verdict = verifyPunch(
    {
      lat: event.lat ?? null,
      lng: event.lng ?? null,
      accuracyM: event.accuracyM ?? null,
      selfieKey: event.selfieKey ?? null,
    },
    siteGeo
      ? {
          lat: siteGeo.lat,
          lng: siteGeo.lng,
          radiusM: siteGeo.geofence_radius_m,
          enforced: siteGeo.geofence_enforced,
          selfieRequired: siteGeo.selfie_required,
        }
      : null,
  );
  if (verdict.rejected)
    return {
      clientEventId,
      status: "rejected",
      message: verdict.message ?? "Punch rejected by site rules",
      verdict,
    };

  const isCheckOut =
    Boolean(event.checkOut) || (event.checkIn === undefined && event.checkOut === "");
  const kind: "checkIn" | "checkOut" = event.checkOut ? "checkOut" : "checkIn";

  // 1. Claim the event id first — this is what makes retries safe.
  if (clientEventId) {
    const claim = await sbRest(ctx, `attendance_events`, {
      method: "POST",
      prefer: "return=representation",
      body: JSON.stringify({
        client_event_id: clientEventId,
        employee_id: employeeId,
        user_id: ctx.userId,
        kind,
        date,
        punched_at: event.punchedAt ?? new Date().toISOString(),
        lat: event.lat ?? null,
        lng: event.lng ?? null,
        address: event.address ?? null,
        site_id: event.siteId ?? null,
        selfie_key: event.selfieKey ?? null,
        accuracy_m: event.accuracyM ?? null,
        distance_m: verdict.distanceM,
        geo_status: verdict.geoStatus,
        verification: verdict.verification,
        flags: verdict.flags,
        source,
        payload: event as unknown as Record<string, unknown>,
      }),
    });
    if (!claim.ok) {
      const text = await claim.text();
      if (claim.status === 409 || text.includes("duplicate key")) {
        const prior = await sbSelect<{ attendance_id: string | null }>(
          ctx,
          `attendance_events?select=attendance_id&employee_id=eq.${encodeURIComponent(employeeId)}&client_event_id=eq.${encodeURIComponent(clientEventId)}&limit=1`,
        );
        const attendanceId = prior[0]?.attendance_id;
        let attendance: unknown = null;
        if (attendanceId) {
          const rows = await sbSelect<Record<string, unknown>>(
            ctx,
            `attendance?select=*&id=eq.${encodeURIComponent(attendanceId)}&limit=1`,
          );
          attendance = rows[0] ? fromAttendance(rows[0]) : null;
        }
        return { clientEventId, status: "duplicate", attendance, verdict };
      }
      return { clientEventId, status: "error", message: "Unable to record punch event" };
    }
  }

  // A worker's own portal punch: the connected database does not let the
  // employee role write attendance, so the server writes this one row with
  // the service key after the caller's token resolved to this employee.
  // Only the punch time/GPS is accepted; status/hours stay staff-controlled.
  const selfPunch =
    directPunch && employeeId === ctx.employeeId && !isStaffCtx(ctx);
  const rest = async (path: string, init?: RequestInit & { prefer?: string }) =>
    (selfPunch ? await serviceRest(path, init) : null) ?? sbRest(ctx, path, init);
  if (selfPunch) {
    for (const [key, value] of [["checkIn", event.checkIn], ["checkOut", event.checkOut]] as const)
      if (value && !/^\d{2}:\d{2}(:\d{2})?$/.test(value))
        return { clientEventId, status: "rejected", message: `${key} must be HH:MM` };
  }

  // 2. Upsert the day's attendance row.
  const lookup = await rest(
    `attendance?select=id&employee_id=eq.${encodeURIComponent(employeeId)}&date=eq.${date}&limit=1`,
  );
  if (!lookup.ok) return { clientEventId, status: "error", message: await upstreamMessage(lookup, "Unable to read today's attendance") };
  const existing = (await lookup.json()) as { id: string }[];
  const payload: Record<string, unknown> = {
    employee_id: employeeId,
    date,
    status: selfPunch ? "Present" : event.status ?? "Present",
  };
  if (!selfPunch) {
    if (event.notes !== undefined) payload["notes"] = event.notes ?? null;
    if (event.siteId) payload["site_id"] = event.siteId;
    if (event.hoursWorked != null) payload["hours_worked"] = event.hoursWorked;
    if (event.overtimeHours != null) payload["overtime_hours"] = event.overtimeHours;
  }
  if (isCheckOut) {
    payload["check_out"] = event.checkOut || timeOf(event.punchedAt);
    if (event.lat != null) payload["check_out_lat"] = event.lat;
    if (event.lng != null) payload["check_out_lng"] = event.lng;
    if (event.address) payload["check_out_address"] = event.address;
    if (event.selfieKey) payload["check_out_selfie_key"] = event.selfieKey;
    payload["check_out_verification"] = verdict.verification;
    if (verdict.distanceM != null) payload["check_out_distance_m"] = verdict.distanceM;
  } else {
    payload["check_in"] = event.checkIn || timeOf(event.punchedAt);
    if (event.lat != null) payload["check_in_lat"] = event.lat;
    if (event.lng != null) payload["check_in_lng"] = event.lng;
    if (event.address) payload["check_in_address"] = event.address;
    if (event.selfieKey) payload["check_in_selfie_key"] = event.selfieKey;
    payload["check_in_verification"] = verdict.verification;
    if (verdict.distanceM != null) payload["check_in_distance_m"] = verdict.distanceM;
  }

  // The connected schema supports times/GPS, but not the optional QR proof
  // columns. Never send those absent columns with a direct portal punch.
  if (directPunch) {
    const columns = new Set(TABLE_COLUMNS.attendance.split(","));
    for (const column of Object.keys(payload)) {
      if (!columns.has(column)) delete payload[column];
    }
  }

  const row = existing[0];
  const res = row
    ? await rest(`attendance?id=eq.${encodeURIComponent(row.id)}&employee_id=eq.${encodeURIComponent(employeeId)}`, {
        method: "PATCH",
        prefer: "return=representation",
        body: JSON.stringify(payload),
      })
    : await rest(`attendance`, {
        method: "POST",
        prefer: "return=representation",
        body: JSON.stringify(payload),
      });
  if (!res.ok) return { clientEventId, status: "error", message: await upstreamMessage(res, "Unable to save attendance") };
  const saved = (await res.json()) as Record<string, unknown>[];
  const savedRow = saved[0];

  // 3. Link the event to the attendance row so a later replay returns it.
  if (clientEventId && savedRow?.["id"]) {
    await sbRest(
      ctx,
      `attendance_events?employee_id=eq.${encodeURIComponent(employeeId)}&client_event_id=eq.${encodeURIComponent(clientEventId)}`,
      {
        method: "PATCH",
        prefer: "return=minimal",
        body: JSON.stringify({ attendance_id: savedRow["id"] }),
      },
    );
  }

  return {
    clientEventId,
    status: "saved",
    attendance: savedRow ? fromAttendance(savedRow) : null,
    verdict,
  };
}

const STAFF_ROLES = ["admin", "hr", "manager", "supervisor"];
function isStaffCtx(ctx: AuthContext) {
  return (ctx.roles ?? []).some((role) => STAFF_ROLES.includes(role));
}

/** Readable reason from a failed database response, logged for diagnosis. */
async function upstreamMessage(res: Response, fallback: string) {
  const text = await res.text().catch(() => "");
  console.error(`[attendance] ${fallback}: ${res.status} ${text.slice(0, 300)}`);
  try {
    const detail = (JSON.parse(text) as { message?: string }).message;
    if (detail) return `${fallback}: ${detail}`;
  } catch { /* not JSON */ }
  return fallback;
}
