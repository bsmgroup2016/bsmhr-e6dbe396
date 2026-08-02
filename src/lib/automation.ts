/** Client wrapper for the admin-only automation trigger. */
import { supabase } from "@/integrations/supabase/client";

export interface AutomationRunResult {
  date: string;
  documentsExpired: number;
  remindersQueued: number;
  missingClockIn: number;
  ir21Pending: number;
  ir21Flagged: number;
  quotaWarnings: number;
  payrollMonth: string | null;
  payrollDraftsCreated: number;
  payrollSkipped: number;
  sent: number;
  emailError?: string;
}

export async function runAutomationsNow(options: {
  dryRun?: boolean;
  forcePayroll?: boolean;
}): Promise<AutomationRunResult> {
  const { data: session } = await supabase.auth.getSession();
  const token = session.session?.access_token;
  if (!token) throw new Error("Please sign in again");
  const res = await fetch("/api/public/automation-run", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(options),
  });
  if (res.status === 403) throw new Error("Only admins can run this automation");
  if (!res.ok) throw new Error((await res.text()) || "Automation run failed");
  return (await res.json()) as AutomationRunResult;
}
