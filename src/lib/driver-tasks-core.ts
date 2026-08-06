/**
 * Pure driver-task domain logic — no Supabase client, safe to import from
 * server routes (API v1) and the future Flutter-facing endpoints.
 */

export const TASK_FLOW = [
  "Assigned",
  "Accepted",
  "En route to pickup",
  "Workers picked up",
  "Workers dropped off",
  "Returning to office",
  "Back at office",
] as const;

export type TaskStatus = (typeof TASK_FLOW)[number] | "Cancelled";

export const TASK_TYPES = [
  "Worker transport",
  "Airport worker pickup",
  "Material run",
  "Office / other errand",
] as const;
export type TaskType = (typeof TASK_TYPES)[number];

export interface DriverTask {
  id: string;
  companyId?: string | null;
  driverEmployeeId: string;
  vehicleId?: string | null;
  siteId?: string | null;
  title: string;
  taskType: TaskType;
  flightNo?: string | null;
  terminal?: string | null;
  arrivingWorkers?: string | null;
  expectedMinutes: number;
  instruction: string;
  pickup?: string | null;
  dropoff?: string | null;
  passengers: number;
  scheduledAt: string;
  status: TaskStatus;
  statusUpdatedAt: string;
  driverNote?: string | null;
  lastLat?: number | null;
  lastLng?: number | null;
  lastLocationAt?: string | null;
}

type Row = Record<string, unknown>;

export const mapDriverTaskRow = (r: Row): DriverTask => ({
  id: r['id'] as string,
  companyId: (r['company_id'] as string) ?? null,
  driverEmployeeId: r['driver_employee_id'] as string,
  vehicleId: (r['vehicle_id'] as string) ?? null,
  siteId: (r['site_id'] as string) ?? null,
  title: (r['title'] as string) ?? "",
  taskType: ((r['task_type'] as TaskType) ?? "Worker transport"),
  flightNo: (r['flight_no'] as string) ?? null,
  terminal: (r['terminal'] as string) ?? null,
  arrivingWorkers: (r['arriving_workers'] as string) ?? null,
  expectedMinutes: Number(r['expected_minutes'] ?? 60),
  instruction: (r['instruction'] as string) ?? "",
  pickup: (r['pickup'] as string) ?? null,
  dropoff: (r['dropoff'] as string) ?? null,
  passengers: Number(r['passengers'] ?? 0),
  scheduledAt: r['scheduled_at'] as string,
  status: (r['status'] as TaskStatus) ?? "Assigned",
  statusUpdatedAt: r['status_updated_at'] as string,
  driverNote: (r['driver_note'] as string) ?? null,
  lastLat: (r['last_lat'] as number) ?? null,
  lastLng: (r['last_lng'] as number) ?? null,
  lastLocationAt: (r['last_location_at'] as string) ?? null,
});

export function nextStatus(status: TaskStatus): TaskStatus | null {
  const i = (TASK_FLOW as readonly string[]).indexOf(status);
  if (i < 0 || i === TASK_FLOW.length - 1) return null;
  return TASK_FLOW[i + 1] as TaskStatus;
}

export function statusTone(status: TaskStatus): "success" | "warning" | "info" | "ghost" {
  if (status === "Back at office" || status === "Workers dropped off") return "success";
  if (status === "Cancelled") return "ghost";
  if (status === "Assigned") return "warning";
  return "info";
}

export const minutesAgo = (iso?: string | null) => {
  if (!iso) return null;
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
};

/** A trip is finished when the driver is back at office (or it was cancelled). */
export const isTaskClosed = (t: DriverTask) =>
  t.status === "Back at office" || t.status === "Cancelled";

export interface DriverAvailability {
  driverEmployeeId: string;
  available: boolean;
  currentTask?: DriverTask;
  /** Approximate ISO time the driver should be back at office and free again. */
  freeAt?: string;
  freeInMinutes?: number;
}

/**
 * Busy = has an open task. Free-again time is estimated from the last status
 * update plus the remaining share of the task's expected duration, so HR can
 * see roughly when a busy driver will be back at office.
 */
export function driverAvailability(driverId: string, tasks: DriverTask[]): DriverAvailability {
  const open = tasks
    .filter((t) => t.driverEmployeeId === driverId && !isTaskClosed(t))
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  const current = open[0];
  if (!current) return { driverEmployeeId: driverId, available: true };

  const step = (TASK_FLOW as readonly string[]).indexOf(current.status);
  const total = current.expectedMinutes || 60;
  const doneShare = step <= 0 ? 0 : step / (TASK_FLOW.length - 1);
  const remaining = Math.max(5, Math.round(total * (1 - doneShare)));
  const base = Math.max(
    new Date(current.statusUpdatedAt).getTime(),
    current.status === "Assigned" ? new Date(current.scheduledAt).getTime() : 0,
  );
  const freeAtMs = base + remaining * 60000;
  return {
    driverEmployeeId: driverId,
    available: false,
    currentTask: current,
    freeAt: new Date(freeAtMs).toISOString(),
    freeInMinutes: Math.max(0, Math.round((freeAtMs - Date.now()) / 60000)),
  };
}
