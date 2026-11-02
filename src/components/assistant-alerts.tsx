import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Bot, Minus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { addNotices, clearNotices, markRead, onNoticesChange, readNotices, type AiNotice } from "@/lib/ai-notices";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const ALERT_ROLES = ["admin", "manager", "hr", "supervisor"];
const dot = (s: AiNotice["severity"]) => (s === "critical" ? "bg-destructive" : s === "warning" ? "bg-warning" : "bg-primary");

/** Checks the assistant's live findings and shows ONE small popup; details go to the AI notifications tray. */
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
        const { insights = [] } = (await res.json()) as { insights?: Omit<AiNotice, "at" | "read">[] };
        const fresh = addNotices(insights);
        if (!fresh.length) return;
        const ids = fresh.map((f) => f.id);
        toast.custom(
          (tid) => (
            <div className="flex w-[320px] items-center gap-2 rounded-xl border bg-card p-3 text-card-foreground shadow-lg">
              <Bot className="h-4 w-4 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{fresh.length} new AI alert{fresh.length > 1 ? "s" : ""}</p>
                <p className="truncate text-xs text-muted-foreground">{fresh[0].title}</p>
              </div>
              <Button size="icon" variant="ghost" className="h-7 w-7" title="Minimize to notifications" onClick={() => toast.dismiss(tid)}>
                <Minus className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" title="Close" onClick={() => { markRead(ids); toast.dismiss(tid); }}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ),
          { duration: 8000 },
        );
      } catch { /* offline */ }
    };
    const first = setTimeout(check, 4000);
    const timer = setInterval(check, 15 * 60 * 1000);
    return () => { stop = true; clearTimeout(first); clearInterval(timer); };
  }, [allowed]);

  return null;
}

/** Header button + tray listing AI notifications. */
export function AiNoticesTray() {
  const { roles } = useAuth();
  const [list, setList] = useState<AiNotice[]>([]);
  useEffect(() => {
    setList(readNotices());
    return onNoticesChange(() => setList(readNotices()));
  }, []);
  if (!roles.some((r) => ALERT_ROLES.includes(r))) return null;
  const unread = list.filter((n) => !n.read).length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-8 w-8 shrink-0" aria-label="AI notifications">
          <Bot className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground ring-1 ring-background">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <p className="text-sm font-semibold">AI notifications</p>
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => markRead()}>Mark all read</Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={clearNotices}>Clear</Button>
          </div>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {list.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">No notifications.</p>}
          {list.map((n) => (
            <button
              key={n.id}
              onClick={() => markRead([n.id])}
              className={cn("flex w-full gap-2 border-b px-3 py-2 text-left last:border-0 hover:bg-muted", !n.read && "bg-muted/50")}
            >
              <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", dot(n.severity))} />
              <span className="min-w-0 flex-1">
                <span className={cn("block text-sm", !n.read && "font-medium")}>{n.title}</span>
                <span className="block text-xs text-muted-foreground">{n.detail}</span>
                {n.names?.length ? <span className="mt-0.5 block text-xs text-muted-foreground">{n.names.slice(0, 6).join(", ")}{n.names.length > 6 ? "…" : ""}</span> : null}
                <span className="mt-0.5 block text-[10px] text-muted-foreground">{new Date(n.at).toLocaleString("en-SG")}</span>
              </span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
