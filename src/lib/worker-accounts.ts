import { authedFetch } from "@/lib/api-client";

async function call(body: unknown) {
  const response = await authedFetch("/api/public/worker-accounts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? "Worker account request failed");
  return data;
}

export async function ensureWorkerAccounts(employeeIds: string[]): Promise<{ results: { employeeId: string; userId?: string; created?: boolean; ok: boolean }[] }> {
  return call({ action: "ensure", employeeIds });
}

export async function resetWorkerPassword(employeeId: string): Promise<{ name: string; username: string; password: string }> {
  return call({ action: "reset-password", employeeId });
}

/** A saved worker remains saved when account provisioning fails; retry is visible in Users. */
export async function autoCreateWorkerAccount(employeeId: string): Promise<string | undefined> {
  if (typeof window === "undefined") return;
  try {
    const { results } = await ensureWorkerAccounts([employeeId]);
    const result = results[0];
    if (!result?.ok) throw new Error("Account not created");
    return result.userId;
  } catch {
    const { toast } = await import("sonner");
    toast.warning("Worker saved. Login could not be created; retry in Users → Worker App.");
    return;
  }
}