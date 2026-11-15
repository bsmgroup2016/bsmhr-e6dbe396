import { useMemo } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
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
import { AUDIT_PAGE_SIZE, auditLogsQueryOptions } from "@/lib/audit-log-data";
import { useAuth } from "@/lib/auth";
import { exportCsv, timestampedName } from "@/lib/xlsx";

const actions = ["CREATE", "UPDATE", "DELETE", "LOGIN", "EXPORT", "APPROVE", "REJECT"];
const entities = ["Employee", "Client", "Project", "Site", "Assignment", "Document", "Attendance", "Payroll", "Approval", "User"];

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
  validateSearch: (s: { page?: number; action?: string; entity?: string; from?: string; to?: string; search?: string }) => ({
    page: Math.max(0, Math.floor(Number(s.page) || 0)), action: s.action ?? "all", entity: s.entity ?? "all",
    from: s.from ?? "", to: s.to ?? "", search: s.search ?? "",
  }),
  loaderDeps: ({ search: { page, action, entity, from, to } }) => ({ page, action, entity, from, to }),
  loader: async ({ context, deps }) => { await context.queryClient.ensureQueryData(auditLogsQueryOptions(deps, context.user.id)); },
  errorComponent: ({ error }) => { const router = useRouter(); return <div role="alert" className="p-6"><p>{error instanceof Error ? error.message : "Could not load audit logs."}</p><Button onClick={() => void router.invalidate()}>Retry</Button></div>; },
  notFoundComponent: () => <div className="p-6">Audit logs not found.</div>,
  head: () => ({
    meta: [
      { title: "Audit Logs — BSM Workforce & Operations" },
      { name: "description", content: "System activity and audit trail." },
      { property: "og:title", content: "Audit Logs — BSM Workforce & Operations" },
      { property: "og:description", content: "System activity and audit trail." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuditLogsPage,
});

export default function AuditLogsPage() {
  const params = Route.useSearch();
  const navigate = Route.useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { page, action, entity, from: periodFrom, to: periodTo } = params;
  const options = auditLogsQueryOptions({ page, action, entity, from: periodFrom, to: periodTo }, user?.id ?? "");
  const { data, isFetching: loading } = useSuspenseQuery(options);
  const logs = data.rows;
  const { search, action: actionFilter, entity: entityFilter, from, to } = params;
  const change = (key: "search" | "action" | "entity" | "from" | "to", value: string) => void navigate({ search: (previous) => ({ ...previous, [key]: value, page: 0 }) });
  const setSearch = (value: string) => change("search", value);
  const setActionFilter = (value: string) => change("action", value);
  const setEntityFilter = (value: string) => change("entity", value);
  const setFrom = (value: string) => change("from", value);
  const setTo = (value: string) => change("to", value);
  const load = () => queryClient.invalidateQueries({ queryKey: options.queryKey });

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
      <div className="w-full space-y-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Audit Logs</h1>
            <p className="text-sm text-muted-foreground">System activity trail and data changes.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => void handleExport()} disabled={!filtered.length}>
              <Download className="mr-1 h-4 w-4" />
              Download current page
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
              <Input type="search" aria-label="Search current page" placeholder="Search current page..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
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

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
            <span>{filtered.length} entries shown · {data.total} total · Page {params.page + 1}</span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" disabled={loading || params.page === 0} onClick={() => void navigate({ search: (previous) => ({ ...previous, page: previous.page - 1 }) })}>Previous</Button>
              <Button variant="ghost" size="sm" disabled={loading || (params.page + 1) * AUDIT_PAGE_SIZE >= data.total} onClick={() => void navigate({ search: (previous) => ({ ...previous, page: previous.page + 1 }) })}>Next</Button>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
