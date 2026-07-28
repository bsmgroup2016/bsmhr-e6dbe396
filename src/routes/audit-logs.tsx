import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ClipboardList, Search, Filter, History } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { getAuditLogs } from "@/lib/store";

const actions = ["CREATE", "UPDATE", "DELETE", "LOGIN", "EXPORT", "APPROVE", "REJECT"];
const entities = ["Employee", "Client", "Project", "Site", "Assignment", "Document", "Attendance", "Payroll", "Approval", "User"];

export const Route = createFileRoute("/audit-logs")({
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
  const [logs] = useState(getAuditLogs());
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [entityFilter, setEntityFilter] = useState<string>("all");

  const filtered = logs.filter((l) => {
    const q = search.toLowerCase();
    return (
      (l.userName.toLowerCase().includes(q) || l.details.toLowerCase().includes(q) || l.entityType.toLowerCase().includes(q)) &&
      (actionFilter === "all" || l.action === actionFilter) &&
      (entityFilter === "all" || l.entityType === entityFilter)
    );
  });

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Audit Logs</h1>
            <p className="text-sm text-muted-foreground">System activity trail and data changes.</p>
          </div>
          <Button variant="outline" size="sm">
            <History className="mr-1 h-4 w-4" />
            Refresh
          </Button>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input type="search" placeholder="Search logs..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <div className="flex gap-2">
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
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center">
                      <EmptyState className="bg-transparent border-0" icon={<ClipboardList className="h-5 w-5" />} title="No logs" description="No matching audit log entries." />
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="whitespace-nowrap">{new Date(l.timestamp).toLocaleString()}</TableCell>
                      <TableCell className="font-medium">{l.userName}</TableCell>
                      <TableCell>{l.action}</TableCell>
                      <TableCell>{l.entityType}</TableCell>
                      <TableCell className="max-w-md truncate">{l.details}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
