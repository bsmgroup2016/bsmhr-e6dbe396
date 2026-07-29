import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, BellRing, Info, ShieldAlert } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { SummaryCard } from "@/components/ui/summary-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ALERT_CATEGORIES, alertCounts, buildAlerts } from "@/lib/alerts";
import type { AlertSeverity } from "@/lib/alerts";
import { getCurrentCompany } from "@/lib/store";

export const Route = createFileRoute("/_authenticated/alerts")({
  head: () => ({
    meta: [
      { title: "Alerts Centre — BSM Workforce & Operations" },
      { name: "description", content: "Every expiry, approval and overdue item across the operation in one feed." },
      { property: "og:title", content: "Alerts Centre — BSM Workforce & Operations" },
      { property: "og:description", content: "Every expiry, approval and overdue item across the operation in one feed." },
    ],
  }),
  component: AlertsPage,
});

const severityStyle: Record<AlertSeverity, string> = {
  critical: "border-destructive/40 bg-destructive/5",
  warning: "border-warning/40 bg-warning/5",
  info: "border-border bg-muted/30",
};

const severityBadge: Record<AlertSeverity, "destructive" | "warning" | "secondary"> = {
  critical: "destructive",
  warning: "warning",
  info: "secondary",
};

function AlertsPage() {
  const companyId = getCurrentCompany();
  const alerts = useMemo(() => buildAlerts(companyId), [companyId]);
  const counts = alertCounts(alerts);
  const [category, setCategory] = useState<string>("All");
  const [severity, setSeverity] = useState<string>("All");

  const filtered = alerts.filter(
    (a) =>
      (category === "All" || a.category === category) &&
      (severity === "All" || a.severity === severity),
  );

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Alerts Centre</h1>
          <p className="text-sm text-muted-foreground">
            Expiries, overdue payments and pending approvals from every module.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard title="Total alerts" value={String(counts.total)} icon={BellRing} />
          <SummaryCard title="Critical" value={String(counts.critical)} icon={ShieldAlert} />
          <SummaryCard title="Warning" value={String(counts.warning)} icon={AlertTriangle} />
          <SummaryCard title="For review" value={String(counts.info)} icon={Info} />
        </div>

        <div className="flex flex-wrap gap-2">
          {["All", ...ALERT_CATEGORIES].map((c) => (
            <Button
              key={c}
              size="sm"
              variant={category === c ? "default" : "outline"}
              onClick={() => setCategory(c)}
            >
              {c}
            </Button>
          ))}
          <span className="mx-1 h-8 w-px bg-border" />
          {["All", "critical", "warning", "info"].map((s) => (
            <Button
              key={s}
              size="sm"
              variant={severity === s ? "default" : "outline"}
              onClick={() => setSeverity(s)}
              className="capitalize"
            >
              {s}
            </Button>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{filtered.length} alert(s)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {filtered.length === 0 ? (
              <EmptyState
                icon={BellRing}
                title="Nothing needs attention"
                description="No alerts match the current filters."
              />
            ) : (
              filtered.map((a) => (
                <Link
                  key={a.id}
                  to={a.link}
                  className={`flex items-start justify-between gap-4 rounded-lg border p-3 transition hover:shadow-elegant ${severityStyle[a.severity]}`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant={severityBadge[a.severity]} className="capitalize">
                        {a.severity}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{a.category}</span>
                    </div>
                    <p className="mt-1 truncate text-sm font-medium">{a.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{a.detail}</p>
                  </div>
                  {a.date && (
                    <span className="shrink-0 text-xs text-muted-foreground">{a.date}</span>
                  )}
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}