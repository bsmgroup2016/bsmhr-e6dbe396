import { useCallback, useEffect, useState } from "react";
import { Activity, CheckCircle2, AlertTriangle, XCircle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { checkR2Status } from "@/lib/r2";

type Status = "ok" | "warn" | "fail";
type Check = { label: string; status: Status; detail: string };

async function countOf(table: string): Promise<number | null> {
  const { count, error } = await supabase.from(table).select("id", { count: "exact", head: true });
  return error ? null : (count ?? 0);
}

export function SystemHealth() {
  const [checks, setChecks] = useState<Check[]>([]);
  const [loading, setLoading] = useState(true);

  const run = useCallback(async () => {
    setLoading(true);
    const result: Check[] = [];

    const employees = await countOf("employees");
    result.push(
      employees === null
        ? { label: "Database connection", status: "fail", detail: "Could not read from the database." }
        : { label: "Database connection", status: "ok", detail: "Connected and readable." },
    );

    const [clients, projects, invoices] = await Promise.all([
      countOf("clients"),
      countOf("projects"),
      countOf("invoices"),
    ]);

    result.push({
      label: "Employee records",
      status: employees && employees > 0 ? "ok" : "warn",
      detail: `${employees ?? 0} employee(s) on file.`,
    });
    result.push({
      label: "Clients & projects",
      status: (clients ?? 0) > 0 && (projects ?? 0) > 0 ? "ok" : "warn",
      detail: `${clients ?? 0} client(s), ${projects ?? 0} project(s).`,
    });
    result.push({
      label: "Billing data",
      status: (invoices ?? 0) > 0 ? "ok" : "warn",
      detail: `${invoices ?? 0} invoice(s) generated.`,
    });

    const { count: adminCount, error: adminErr } = await supabase
      .from("user_roles")
      .select("user_id", { count: "exact", head: true })
      .eq("role", "admin");
    result.push({
      label: "Administrator accounts",
      status: adminErr ? "warn" : (adminCount ?? 0) > 0 ? "ok" : "fail",
      detail: adminErr ? "Role list not readable with this account." : `${adminCount ?? 0} admin user(s).`,
    });

    try {
      const r2 = await checkR2Status();
      result.push({
        label: "File storage (R2)",
        status: r2.configured ? (r2.reachable ? "ok" : "warn") : "fail",
        detail: r2.configured
          ? r2.reachable
            ? "Bucket reachable."
            : `Bucket responded ${r2.status ?? "unexpectedly"}.`
          : r2.message || "Storage keys are missing.",
      });
    } catch {
      result.push({ label: "File storage (R2)", status: "warn", detail: "Storage check unavailable." });
    }

    setChecks(result);
    setLoading(false);
  }, []);

  useEffect(() => {
    void run();
  }, [run]);

  const icon = (s: Status) =>
    s === "ok" ? (
      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
    ) : s === "warn" ? (
      <AlertTriangle className="h-4 w-4 text-amber-500" />
    ) : (
      <XCircle className="h-4 w-4 text-destructive" />
    );

  const failing = checks.filter((c) => c.status !== "ok").length;

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">System health & go-live checklist</h2>
        </div>
        <Button variant="outline" size="sm" onClick={() => void run()} disabled={loading}>
          <RefreshCw className={loading ? "mr-1 h-4 w-4 animate-spin" : "mr-1 h-4 w-4"} />
          Re-check
        </Button>
      </div>

      {loading && checks.length === 0 ? (
        <p className="text-sm text-muted-foreground">Running checks…</p>
      ) : (
        <>
          <p className="mb-3 text-sm text-muted-foreground">
            {failing === 0
              ? "All checks passed — the system is ready for daily use."
              : `${failing} item(s) need attention before go-live.`}
          </p>
          <ul className="divide-y rounded-lg border">
            {checks.map((c) => (
              <li key={c.label} className="flex items-start gap-3 p-3">
                <span className="mt-0.5">{icon(c.status)}</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{c.label}</p>
                  <p className="text-sm text-muted-foreground">{c.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
