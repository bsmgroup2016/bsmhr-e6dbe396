import { supabase } from "@/integrations/supabase/client";

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