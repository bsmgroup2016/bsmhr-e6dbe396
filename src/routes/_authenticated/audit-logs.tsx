import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ClipboardList, Search, History, Download, Loader2 } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { exportCsv, timestampedName } from "@/lib/xlsx";

const actions = ["CREATE", "UPDATE", "DELETE", "LOGIN", "EXPORT", "APPROVE", "REJECT"];
const entities = ["Employee", "Client", "Project", "Site", "Assignment", "Document", "Attendance", "Payroll", "Approval", "User"];
const PAGE_SIZE = 100;

type LogRow = {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  user_name: string | null;
  details: unknown;
  created_at: string;
};

function detailText(details: unknown): string {
  if (!details) return "";
  if (typeof details === "string") return details;
  if (typeof details === "object" && details !== null && "text" in details) {
    const t = (details as { text?: unknown }).text;
    if (typeof t === "string") return t;
  }
  return JSON.stringify(details);
}

const actionTone: Record<string, string> = {
  CREATE: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  UPDATE: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  DELETE: "bg-red-500/10 text-red-600 border-red-500/20",
  APPROVE: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  REJECT: "bg-red-500/10 text-red-600 border-red-500/20",
};

export const Route = createFileRoute("/_authenticated/audit-logs")({
  head: () => ({
    meta: [
      { title: "Audit Logs — BSM Workforce & Operations" },
      { name: "description", content: "System activity and audit trail." },
      { property: "og:title", content: "Audit Logs — BSM Workforce & Operations" },
      { property: "og:description", content: "System activity and audit trail." },
    ],
  }),
  component: AuditLogsPage,
});

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [limit, setLimit] = useState(PAGE_SIZE);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    let query = supabase
      .from("audit_logs")
      .select("id,action,entity_type,entity_id,user_name,details,created_at")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (actionFilter !== "all") query = query.eq("action", actionFilter);
    if (entityFilter !== "all") query = query.eq("entity_type", entityFilter);
    if (from) query = query.gte("created_at", new Date(`${from}T00:00:00`).toISOString());
    if (to) query = query.lte("created_at", new Date(`${to}T23:59:59`).toISOString());
    const { data, error: err } = await query;
    if (err) setError("Could not load audit logs.");
    setLogs((data as LogRow[] | null) ?? []);
    setLoading(false);
  }, [actionFilter, entityFilter, from, to, limit]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter((l) =>
      `${l.user_name ?? ""} ${l.entity_type} ${detailText(l.details)}`.toLowerCase().includes(q),
    );
  }, [logs, search]);

  async function handleExport() {
    await exportCsv(
      filtered.map((l) => ({
        Timestamp: new Date(l.created_at).toLocaleString(),
        User: l.user_name ?? "System",
        Action: l.action,
        Entity: l.entity_type,
        "Entity ID": l.entity_id ?? "",
        Details: detailText(l.details),
      })),
      timestampedName("audit_logs", "csv"),
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Audit Logs</h1>
            <p className="text-sm text-muted-foreground">System activity trail and data changes.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => void handleExport()} disabled={!filtered.length}>
              <Download className="mr-1 h-4 w-4" />
              Export CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              {loading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <History className="mr-1 h-4 w-4" />}
              Refresh
            </Button>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input type="search" placeholder="Search logs..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" aria-label="From date" />
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" aria-label="To date" />
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All actions</SelectItem>
                  {actions.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={entityFilter} onValueChange={setEntityFilter}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Entity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All entities</SelectItem>
                  {entities.map((e) => (
                    <SelectItem key={e} value={e}>
                      {e}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}

          <div className="mt-4 overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-sm text-muted-foreground">
                      Loading audit trail…
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center">
                      <EmptyState className="bg-transparent border-0" icon={<ClipboardList className="h-5 w-5" />} title="No logs" description="No matching audit log entries." />
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="whitespace-nowrap">{new Date(l.created_at).toLocaleString()}</TableCell>
                      <TableCell className="font-medium">{l.user_name ?? "System"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={actionTone[l.action] ?? ""}>{l.action}</Badge>
                      </TableCell>
                      <TableCell>{l.entity_type}</TableCell>
                      <TableCell className="max-w-md truncate">{detailText(l.details)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
            <span>{filtered.length} entries shown</span>
            {logs.length >= limit ? (
              <Button variant="ghost" size="sm" onClick={() => setLimit((n) => n + PAGE_SIZE)}>
                Load more
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
