import { supabase } from "@/integrations/supabase/client";

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

const map = (r: Row): DriverTask => ({
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

export async function listDriverTasks(): Promise<DriverTask[]> {
  const { data, error } = await supabase
    .from("driver_tasks")
    .select("*")
    .order("scheduled_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(map);
}

export async function createDriverTask(input: {
  driverEmployeeId: string;
  companyId?: string | null;
  vehicleId?: string | null;
  siteId?: string | null;
  title: string;
  taskType?: TaskType;
  flightNo?: string;
  terminal?: string;
  arrivingWorkers?: string;
  expectedMinutes?: number;
  instruction: string;
  pickup?: string;
  dropoff?: string;
  passengers: number;
  scheduledAt: string;
}): Promise<void> {
  const { error } = await supabase.from("driver_tasks").insert({
    driver_employee_id: input.driverEmployeeId,
    company_id: input.companyId ?? null,
    vehicle_id: input.vehicleId || null,
    site_id: input.siteId || null,
    title: input.title,
    task_type: input.taskType ?? "Worker transport",
    flight_no: input.flightNo || null,
    terminal: input.terminal || null,
    arriving_workers: input.arrivingWorkers || null,
    expected_minutes: input.expectedMinutes ?? 60,
    instruction: input.instruction,
    pickup: input.pickup || null,
    dropoff: input.dropoff || null,
    passengers: input.passengers,
    scheduled_at: input.scheduledAt,
    status: "Assigned",
    status_updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function updateTaskStatus(
  id: string,
  status: TaskStatus,
  extra?: { note?: string; lat?: number; lng?: number },
): Promise<void> {
  const patch: Row = {
    status,
    status_updated_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (extra?.note !== undefined) patch['driver_note'] = extra.note;
  if (extra?.lat !== undefined && extra?.lng !== undefined) {
    patch['last_lat'] = extra.lat;
    patch['last_lng'] = extra.lng;
    patch['last_location_at'] = new Date().toISOString();
  }
  const { error } = await supabase.from("driver_tasks").update(patch).eq("id", id);
  if (error) throw error;
}

export async function pushDriverLocation(id: string, lat: number, lng: number): Promise<void> {
  const { error } = await supabase
    .from("driver_tasks")
    .update({ last_lat: lat, last_lng: lng, last_location_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteDriverTask(id: string): Promise<void> {
  const { error } = await supabase.from("driver_tasks").delete().eq("id", id);
  if (error) throw error;
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
