import { useState } from "react";
import { Bot, Play, FlaskConical, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { runAutomationsNow, type AutomationRunResult } from "@/lib/automation";

const JOBS = [
  { title: "Document auto-expiry", detail: "Permits/passports past their validity are marked Expired automatically." },
  { title: "Tiered expiry reminders", detail: "Email notices to HR at 90 / 60 / 30 / 7 days before expiry." },
  { title: "Missing clock-in alerts", detail: "List of site workers who have not punched in today." },
  { title: "IR21 tax clearance", detail: "Flags leaving foreign employees for IR21 and warns on deadlines." },
  { title: "DRC quota & levy warnings", detail: "Per-company quota breaches and monthly levy exposure." },
  { title: "Month-end payroll draft", detail: "Builds drafts from attendance with OT, CPF/SDL/SHG and loan deductions." },
];

const rows = (r: AutomationRunResult) => [
  ["Documents marked expired", r.documentsExpired],
  ["Expiry reminders", r.remindersQueued],
  ["Missing clock-in", r.missingClockIn],
  ["IR21 pending", r.ir21Pending],
  ["IR21 newly flagged", r.ir21Flagged],
  ["Quota / levy warnings", r.quotaWarnings],
  [`Payroll drafts (${r.payrollMonth ?? "—"})`, r.payrollDraftsCreated],
  ["Payroll skipped", r.payrollSkipped],
  ["Emails accepted by provider", r.sent],
] as const;

export function AutomationCentre() {
  const [busy, setBusy] = useState<"dry" | "live" | null>(null);
  const [result, setResult] = useState<AutomationRunResult | null>(null);
  const [mode, setMode] = useState<"dry" | "live">("dry");
  const [error, setError] = useState<string | null>(null);

  async function run(kind: "dry" | "live") {
    setBusy(kind);
    setError(null);
    try {
      const r = await runAutomationsNow({ dryRun: kind === "dry", forcePayroll: true });
      setResult(r);
      setMode(kind);
    } catch (e) {
      setResult(null);
      setError(e instanceof Error ? e.message : "Automation run failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/60 bg-card/60 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="rounded-lg bg-primary/10 p-2 text-primary">
              <Bot className="h-5 w-5" />
            </span>
            <div>
              <h3 className="font-medium text-foreground">Automation centre</h3>
              <p className="text-sm text-muted-foreground">
                Schedule: daily 08:00 SGT via database cron. You can also dry-run or run it now from here.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => run("dry")} disabled={busy !== null}>
              {busy === "dry" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FlaskConical className="mr-2 h-4 w-4" />}
              Dry run
            </Button>
            <Button onClick={() => run("live")} disabled={busy !== null}>
              {busy === "live" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
              Run now
            </Button>
          </div>
        </div>

        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

        {result && (
          <div className="mt-5 space-y-3">
            {result.emailError && (
              <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-foreground">
                The job ran, but the digest email could not be sent: {result.emailError}
              </p>
            )}
            <div className="flex items-center gap-2">
              <Badge variant={mode === "dry" ? "secondary" : "default"}>
                {mode === "dry" ? "Dry run — nothing was written" : "Live run completed"}
              </Badge>
              <span className="text-xs text-muted-foreground">{result.date}</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {rows(result).map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-center justify-between rounded-lg border border-border/50 bg-background/50 px-3 py-2"
                >
                  <span className="text-sm text-muted-foreground">{label}</span>
                  <span className="text-sm font-semibold text-foreground">{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {JOBS.map((j) => (
          <div key={j.title} className="rounded-lg border border-border/50 bg-card/40 p-4">
            <p className="text-sm font-medium text-foreground">{j.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{j.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
