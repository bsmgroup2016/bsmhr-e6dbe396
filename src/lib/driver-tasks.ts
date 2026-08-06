import { supabase } from "@/integrations/supabase/client";
import { mapDriverTaskRow, type DriverTask, type TaskStatus, type TaskType } from "@/lib/driver-tasks-core";
import { pushToEmployees } from "@/lib/notify";

export * from "@/lib/driver-tasks-core";

type Row = Record<string, unknown>;
const map = mapDriverTaskRow;

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
  void pushToEmployees([input.driverEmployeeId], {
    title: "New trip assigned",
    body: `${input.title} — ${new Date(input.scheduledAt).toLocaleString("en-SG")}`,
    category: "driver_task",
    data: { type: "driver_task" },
  });
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

