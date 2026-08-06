import { supabase } from "@/integrations/supabase/client";

/**
 * Send an in-app + push notification to employees (staff only).
 * Fire-and-forget: notification failures never block the business action.
 */
export async function pushToEmployees(
  employeeIds: string[],
  payload: { title: string; body?: string; category?: string; data?: Record<string, string> },
) {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    await fetch("/api/public/v1/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ employeeIds, ...payload }),
    });
  } catch {
    /* ignore */
  }
}

/** Fire-and-forget email notification for a leave decision. */
export async function notifyLeaveDecision(leaveId: string, status: "Approved" | "Rejected") {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    await fetch("/api/public/notify-leave", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ leaveId, status }),
    });
  } catch {
    /* email failure must never block the approval flow */
  }
}