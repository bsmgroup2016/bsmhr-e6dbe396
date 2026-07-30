import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Mail,
  Power,
  Search,
  Shield,
  User as UserIcon,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { SummaryCard } from "@/components/ui/summary-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { ROLE_LABELS, type AppAuthRole } from "@/lib/permissions";

const roles: AppAuthRole[] = [
  "admin",
  "manager",
  "hr",
  "supervisor",
  "employee",
  "client_user",
];

interface SystemUser {
  id: string;
  email: string;
  fullName: string;
  isActive: boolean;
  role: AppAuthRole | null;
  createdAt: string;
}

export const Route = createFileRoute("/_authenticated/users")({
  head: () => ({
    meta: [
      { title: "Users & Permissions — BSM Workforce & Operations" },
      { name: "description", content: "Manage system users, roles and access permissions." },
      { property: "og:title", content: "Users & Permissions — BSM Workforce & Operations" },
      { property: "og:description", content: "Manage system users, roles and access permissions." },
    ],
  }),
  component: UsersPage,
});

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<AppAuthRole | "all">("all");
  const [perPage, setPerPage] = useState("10");
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: profiles, error: pErr }, { data: roleRows, error: rErr }] = await Promise.all([
      supabase.from("profiles").select("id, email, full_name, is_active, created_at"),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    if (pErr || rErr) {
      toast.error(pErr?.message ?? rErr?.message ?? "Could not load users");
      setLoading(false);
      return;
    }
    const roleMap = new Map<string, AppAuthRole>();
    (roleRows ?? []).forEach((r) => roleMap.set(r.user_id as string, r.role as AppAuthRole));
    setUsers(
      (profiles ?? []).map((p) => ({
        id: p.id as string,
        email: (p.email as string) ?? "",
        fullName: (p.full_name as string) ?? "—",
        isActive: p.is_active !== false,
        role: roleMap.get(p.id as string) ?? null,
        createdAt: (p.created_at as string) ?? "",
      })),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function changeRole(u: SystemUser, role: AppAuthRole | "none") {
    setSavingId(u.id);
    const { error: delErr } = await supabase.from("user_roles").delete().eq("user_id", u.id);
    if (delErr) {
      toast.error(delErr.message);
      setSavingId(null);
      return;
    }
    if (role === "none") {
      setSavingId(null);
      toast.success("Role removed — user is now a normal user");
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, role: null } : x)));
      return;
    }
    const { error } = await supabase.from("user_roles").insert({ user_id: u.id, role });
    setSavingId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Role updated to ${role.replace("_", " ")}`);
    setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, role } : x)));
  }

  async function toggleActive(u: SystemUser) {
    setSavingId(u.id);
    const { error } = await supabase
      .from("profiles")
      .update({ is_active: !u.isActive })
      .eq("id", u.id);
    setSavingId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, isActive: !x.isActive } : x)));
    toast.success(u.isActive ? "User deactivated" : "User activated");
  }

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    const matchesQuery =
      u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    return matchesQuery && (roleFilter === "all" || u.role === roleFilter);
  });

  const pageSize = Number(perPage);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = useMemo(
    () => filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filtered, currentPage, pageSize],
  );

  useEffect(() => {
    setPage(1);
  }, [search, roleFilter, perPage]);

  const activeCount = users.filter((u) => u.isActive).length;
  const adminCount = users.filter((u) => u.role === "admin").length;
  const unassigned = users.filter((u) => !u.role).length;

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Users & Permissions
            </h1>
            <p className="text-sm text-muted-foreground">
              Accounts registered in Supabase. Assign a role to control what each user can open.
            </p>
          </div>
          <Button size="sm" variant="outline" className="mt-2 sm:mt-0" onClick={() => void load()}>
            Refresh
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard title="Total users" value={users.length.toString()} icon={<UserIcon className="h-5 w-5" />} variant="primary" caption="System accounts" />
          <SummaryCard title="Active" value={activeCount.toString()} icon={<CheckCircle2 className="h-5 w-5" />} variant="success" caption="Can log in" />
          <SummaryCard title="Admins" value={adminCount.toString()} icon={<Shield className="h-5 w-5" />} variant="warning" caption="Full access" />
          <SummaryCard title="No role" value={unassigned.toString()} icon={<Shield className="h-5 w-5" />} variant="info" caption="Awaiting assignment" />
        </div>

        <div className="rounded-xl border bg-card shadow-sm">
          <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2">
              <Select value={perPage} onValueChange={setPerPage}>
                <SelectTrigger className="h-9 w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["10", "25", "50", "100"].map((n) => (
                    <SelectItem key={n} value={n}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground">records per page</span>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as AppAuthRole | "all")}>
                <SelectTrigger className="h-9 w-44">
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All roles</SelectItem>
                  {roles.map((r) => (
                    <SelectItem key={r} value={r} className="capitalize">
                      {r.replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-9 pl-9"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="min-w-[240px]">User</TableHead>
                  <TableHead className="min-w-[220px]">Contact</TableHead>
                  <TableHead className="min-w-[200px]">Account info</TableHead>
                  <TableHead className="w-56">Role</TableHead>
                  <TableHead className="w-28">Status</TableHead>
                  <TableHead className="w-28 text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center">
                      <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : paged.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center">
                      <EmptyState
                        className="border-0 bg-transparent"
                        icon={<UserIcon className="h-5 w-5" />}
                        title="No users found"
                        description="Users appear here after they register an account."
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  paged.map((u) => (
                    <TableRow key={u.id} className="align-top">
                      <TableCell>
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-primary text-xs font-semibold text-primary-foreground">
                            {(u.fullName !== "—" ? u.fullName : u.email)
                              .slice(0, 2)
                              .toUpperCase()}
                          </div>
                          <div className="space-y-0.5">
                            <div className="text-sm font-semibold text-primary">
                              {u.fullName}
                              {u.id === currentUser?.id && (
                                <span className="ml-2 text-xs font-normal text-muted-foreground">
                                  (you)
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              <span className="font-medium text-foreground">Role : </span>
                              {u.role ? ROLE_LABELS[u.role] : "Normal user"}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span className="truncate">{u.email || "—"}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                          <span>
                            Joined :{" "}
                            {u.createdAt
                              ? new Date(u.createdAt).toLocaleDateString("en-SG", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                })
                              : "—"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={u.role ?? ""}
                          onValueChange={(v) => void changeRole(u, v as AppAuthRole | "none")}
                          disabled={savingId === u.id}
                        >
                          <SelectTrigger className="h-8 w-52">
                            <SelectValue placeholder="Normal user (no role)" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Normal user (no role)</SelectItem>
                            {roles.map((r) => (
                              <SelectItem key={r} value={r}>
                                {ROLE_LABELS[r]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <StatusBadge
                          variant={u.isActive ? "success" : "ghost"}
                          label={u.isActive ? "active" : "inactive"}
                          dot
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant={u.isActive ? "outline" : "default"}
                          className="gap-1.5"
                          aria-label={u.isActive ? "Deactivate user" : "Activate user"}
                          disabled={savingId === u.id || u.id === currentUser?.id}
                          onClick={() => void toggleActive(u)}
                        >
                          <Power className="h-3.5 w-3.5" />
                          {u.isActive ? "Disable" : "Enable"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col items-center justify-between gap-3 border-t p-4 sm:flex-row">
            <p className="text-xs text-muted-foreground">
              Showing {filtered.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}–
              {Math.min(currentPage * pageSize, filtered.length)} of {filtered.length} users
            </p>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={currentPage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
                Prev
              </Button>
              <span className="text-xs text-muted-foreground">
                Page {currentPage} / {totalPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={currentPage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
