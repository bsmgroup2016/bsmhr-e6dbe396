import { useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

type Insight = { id: string; severity: "critical" | "warning" | "info"; title: string; detail: string; names?: string[] };
const ALERT_ROLES = ["admin", "manager", "hr", "supervisor"];
const SEEN_KEY = "bsm-assistant-alerts-seen";

/** Polls the assistant's live checks and pops up each new finding once per day for HR/staff. */
export function AssistantAlerts() {
  const { user, roles } = useAuth();
  const allowed = !!user && roles.some((r) => ALERT_ROLES.includes(r));

  useEffect(() => {
    if (!allowed) return;
    let stop = false;
    const check = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const t = data.session?.access_token;
        if (!t) return;
        const res = await fetch("/api/public/ai-alerts", { headers: { Authorization: `Bearer ${t}` } });
        if (!res.ok || stop) return;
        const { insights = [] } = (await res.json()) as { insights?: Insight[] };
        let seen: string[] = [];
        try { seen = JSON.parse(localStorage.getItem(SEEN_KEY) || "[]"); } catch { /* ignore */ }
        const fresh = insights.filter((i) => !seen.includes(i.id)).slice(0, 5);
        fresh.forEach((i, n) => {
          setTimeout(() => {
            const show = i.severity === "critical" ? toast.error : i.severity === "warning" ? toast.warning : toast.info;
            show(`AI Assistant: ${i.title}`, {
              description: `${i.detail}${i.names?.length ? `\n${i.names.slice(0, 5).join(", ")}${i.names.length > 5 ? "…" : ""}` : ""}`,
              duration: 15000,
            });
          }, n * 700);
        });
        localStorage.setItem(SEEN_KEY, JSON.stringify([...seen, ...fresh.map((i) => i.id)].slice(-300)));
      } catch { /* offline or not ready */ }
    };
    const first = setTimeout(check, 4000);
    const timer = setInterval(check, 15 * 60 * 1000);
    return () => {
      stop = true;
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [allowed]);

  return null;
}
