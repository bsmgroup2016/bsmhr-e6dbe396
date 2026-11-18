import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Globe,
  Loader2,
  KeyRound,
  Mail,
  Pencil,
  Phone,
  Plus,
  Power,
  Search,
  Shield,
  Smartphone,
  Trash2,
  User as UserIcon,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { SummaryCard } from "@/components/ui/summary-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { createUser, deleteUsers, updateUser, setUserRole } from "@/lib/user-admin";
import { uploadToR2 } from "@/lib/r2";
import { accountGroup, displayRole, type AccountGroup } from "@/features/user-directory/groups";
import { ensureWorkerAccounts, resetWorkerPassword } from "@/lib/worker-accounts";

const roles: AppAuthRole[] = [
  "admin",
  "manager",
  "hr",
  "supervisor",
  "driver",
  "accounts",
  "it",
  "employee",
  "client_user",
];

interface SystemUser {
  id: string;
  email: string;
  phone: string;
  fullName: string;
  username: string;
  avatarKey: string | null;
  isActive: boolean;
  role: AppAuthRole | null;
  roles: AppAuthRole[];
  createdAt: string;
  lastLoginAt: string | null;
  lastLoginIp: string | null;
}

function fmtDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-SG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function fmtDateTime(value?: string | null) {
  if (!value) return "Never";
  return new Date(value).toLocaleString("en-SG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const Route = createFileRoute("/_authenticated/users")({
  head: () => ({
    meta: [
      { title: "Users & Permissions — BSM Workforce & Operations" },
      { name: "description", content: "Manage system users, roles and access permissions." },
      { property: "og:title", content: "Users & Permissions — BSM Workforce & Operations" },
      { property: "og:description", content: "Manage system users, roles and access permissions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
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
  const [group, setGroup] = useState<AccountGroup>("staff");
  const [perPage, setPerPage] = useState("10");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [editUser, setEditUser] = useState<SystemUser | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [workers, setWorkers] = useState<{ id: string; name: string; employee_code: string; user_id: string | null }[]>([]);
  const [provisioning, setProvisioning] = useState(false);
  const [credentials, setCredentials] = useState<{ name: string; username: string; password: string } | null>(null);
  const [passwordWorker, setPasswordWorker] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: profiles, error: pErr }, { data: roleRows, error: rErr }, workerResult] = await Promise.all([
      supabase
        .from("profiles")
        .select(
          "id, email, full_name, username, avatar_key, phone, is_active, created_at, last_login_at, last_login_ip",
        ),
      supabase.from("user_roles").select("user_id, role"),
      (async () => {
        const rows: { id: string; name: string; employee_code: string; user_id: string | null }[] = [];
        for (let offset = 0; ; offset += 500) {
          const result = await supabase.from("employees").select("id,name,employee_code,user_id").order("id").range(offset, offset + 499);
          if (result.error) return { rows, error: result.error };
          rows.push(...result.data);
          if (result.data.length < 500) return { rows, error: null };
        }
      })(),
    ]);
    if (workerResult.error) toast.error("Could not load worker login links");
    else setWorkers(workerResult.rows);
    if (pErr || rErr) {
      toast.error(pErr?.message ?? rErr?.message ?? "Could not load users");
      setLoading(false);
      return;
    }
    const roleMap = new Map<string, AppAuthRole[]>();
    (roleRows ?? []).forEach((r) => {
      const id = r.user_id as string;
      roleMap.set(id, [...(roleMap.get(id) ?? []), r.role as AppAuthRole]);
    });
    setUsers(
      (profiles ?? []).map((p) => ({
        id: p.id as string,
        email: (p.email as string) ?? "",
        phone: (p.phone as string) ?? "",
        fullName: (p.full_name as string) ?? "—",
        username: (p.username as string) ?? "",
        avatarKey: (p.avatar_key as string) ?? null,
        isActive: p.is_active !== false,
        role: displayRole(roleMap.get(p.id as string) ?? []),
        roles: roleMap.get(p.id as string) ?? [],
        createdAt: (p.created_at as string) ?? "",
        lastLoginAt: (p.last_login_at as string) ?? null,
        lastLoginIp: (p.last_login_ip as string) ?? null,
      })),
    );
    setSelected([]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function changeRole(u: SystemUser, role: AppAuthRole | "none") {
    setSavingId(u.id);
    try {
      await setUserRole(u.id, role);
      setUsers((prev) => prev.map((x) => x.id === u.id ? { ...x, role: role === "none" ? null : role, roles: role === "none" ? [] : [role] } : x));
      setSelected((prev) => prev.filter((id) => id !== u.id));
      toast.success(role === "none" ? "Role removed — welcome-only access" : `Role updated to ${role.replace("_", " ")}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update role");
    } finally {
      setSavingId(null);
    }
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

  async function runDelete(ids: string[]) {
    setBusy(true);
    try {
      await deleteUsers(ids);
      toast.success(`${ids.length} user(s) deleted`);
      setConfirmDelete(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  const groupUsers = users.filter((u) => accountGroup(u.roles) === group);
  const filtered = groupUsers.filter((u) => {
    const q = search.toLowerCase();
    const matchesQuery =
      u.fullName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q) ||
      u.phone.toLowerCase().includes(q);
    return matchesQuery && (roleFilter === "all" || u.roles.includes(roleFilter));
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

  const selectableIds = paged.filter((u) => u.id !== currentUser?.id).map((u) => u.id);
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.includes(id));

  const activeCount = groupUsers.filter((u) => u.isActive).length;
  const staffCount = users.filter((u) => accountGroup(u.roles) === "staff").length;
  const workerCount = users.filter((u) => accountGroup(u.roles) === "workers").length;
  const unassigned = users.filter((u) => accountGroup(u.roles) === "unassigned").length;
  const groupTitle = group === "workers" ? "Worker App Accounts" : group === "staff" ? "Admin & Staff Accounts" : "Unassigned Accounts";
  const availableFilters = group === "workers" ? ["employee" as const] : group === "staff" ? roles.filter((r) => r !== "employee") : [];
  const missingWorkers = workers.filter(worker => !worker.user_id);

  async function createMissingAccounts() {
    setProvisioning(true);
    let failed = 0;
    let ready = 0;
    try {
      for (let offset = 0; offset < missingWorkers.length; offset += 20) {
        const response = await ensureWorkerAccounts(missingWorkers.slice(offset, offset + 20).map(worker => worker.id));
        ready += response.results.filter(result => result.ok).length;
        failed += response.results.filter(result => !result.ok).length;
      }
      if (ready) toast.success(`${ready} worker logins ready`);
      if (failed) toast.error(`${failed} worker logins could not be created. Retry remaining workers.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Worker login creation failed");
    } finally {
      await load();
      setProvisioning(false);
    }
  }

  async function setWorkerPassword(employeeId: string) {
    setPasswordWorker(null);
    setSavingId(employeeId);
    try { setCredentials(await resetWorkerPassword(employeeId)); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Could not set password"); }
    finally { setSavingId(null); }
  }

  function switchGroup(value: string) {
    if (value !== "staff" && value !== "workers" && value !== "unassigned") return;
    setGroup(value);
    setRoleFilter("all");
    setSearch("");
    setSelected([]);
    setPage(1);
  }

  return (
    <AppShell>
      <div className="w-full space-y-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              Users & Permissions
            </h1>
          </div>
          <Button size="sm" variant="outline" className="mt-2 sm:mt-0" onClick={() => void load()}>
            Refresh
          </Button>
        </div>

        <Tabs value={group} onValueChange={switchGroup} className="space-y-4">
          <TabsList aria-label="Account lists" className="w-full sm:w-auto">
            <TabsTrigger value="staff" className="flex-1 sm:flex-none"><Shield className="h-4 w-4 shrink-0" />Admin & Staff <span className="text-xs tabular-nums">({staffCount})</span></TabsTrigger>
            <TabsTrigger value="workers" className="flex-1 sm:flex-none"><Smartphone className="h-4 w-4 shrink-0" />Worker App <span className="text-xs tabular-nums">({workerCount})</span></TabsTrigger>
            <TabsTrigger value="unassigned" className="flex-1 sm:flex-none"><UserIcon className="h-4 w-4 shrink-0" />Unassigned <span className="text-xs tabular-nums">({unassigned})</span></TabsTrigger>
          </TabsList>
          <TabsContent key={group} value={group} className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-foreground">{groupTitle}</h2>
          {group === "workers" && <span className="flex items-center gap-1.5 text-sm text-muted-foreground"><Smartphone className="h-4 w-4" />Worker Portal</span>}
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <SummaryCard title="Accounts" value={groupUsers.length.toString()} icon={<UserIcon className="h-5 w-5" />} variant="primary" caption={group === "workers" ? "Worker app logins" : group === "staff" ? "Office & client logins" : "Awaiting assignment"} />
          <SummaryCard title="Active" value={activeCount.toString()} icon={<CheckCircle2 className="h-5 w-5" />} variant="success" caption="Can log in" />
          <SummaryCard title="Inactive" value={(groupUsers.length - activeCount).toString()} icon={<Power className="h-5 w-5" />} variant="warning" caption="Disabled accounts" />
        </div>

        {group === "workers" && missingWorkers.length > 0 && <section className="space-y-3 border-y py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-semibold">Workers without login ({missingWorkers.length})</h3>
            <Button size="sm" disabled={provisioning} onClick={() => void createMissingAccounts()}>
              {provisioning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Create missing logins
            </Button>
          </div>
          <div className="max-h-56 overflow-auto divide-y">
            {missingWorkers.map(worker => <div key={worker.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="min-w-0 break-words">{worker.name} <span className="text-muted-foreground">· {worker.employee_code}</span></span>
              <StatusBadge variant="warning" label="Login pending" />
            </div>)}
          </div>
        </section>}

        <div className="rounded-xl border bg-card shadow-sm">
          <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" className="gap-1.5" onClick={() => setAddOpen(true)}>
                <Plus className="h-4 w-4" />
                {group === "workers" ? "Add Worker Account" : "Add User"}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="gap-1.5"
                disabled={selected.length === 0}
                onClick={() => setConfirmDelete(selected)}
              >
                <Trash2 className="h-4 w-4" />
                Bulk Delete{selected.length > 0 ? ` (${selected.length})` : ""}
              </Button>
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
              {group === "staff" && <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as AppAuthRole | "all")}>
                <SelectTrigger className="h-9 w-44">
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All roles</SelectItem>
                  {availableFilters.map((r) => (
                    <SelectItem key={r} value={r} className="capitalize">
                      {ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>}
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder={group === "workers" ? "Search worker accounts…" : "Search accounts…"}
                  aria-label="Search accounts"
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
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allSelected}
                      aria-label="Select all users on this page"
                      onCheckedChange={(v) =>
                        setSelected(v === true ? selectableIds : [])
                      }
                    />
                  </TableHead>
                  <TableHead className="min-w-[240px]">{group === "workers" ? "Worker" : "User"}</TableHead>
                  <TableHead className="min-w-[220px]">{group === "workers" ? "Login ID / Phone" : "Login email / Phone"}</TableHead>
                  <TableHead className="min-w-[230px]">Login info</TableHead>
                  <TableHead className="w-56">Role</TableHead>
                  <TableHead className="w-28">Status</TableHead>
                  <TableHead className="w-40 text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center">
                      <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : paged.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center">
                      <EmptyState
                        className="border-0 bg-transparent"
                        icon={<UserIcon className="h-5 w-5" />}
                        title={search || roleFilter !== "all" ? "No matching accounts" : group === "workers" ? "No worker app accounts" : "No accounts"}
                        description={search || roleFilter !== "all" ? "" : group === "workers" ? "No accounts have the Employee role." : ""}
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  paged.map((u) => (
                    <TableRow key={u.id} className="align-top">
                      <TableCell>
                        <Checkbox
                          checked={selected.includes(u.id)}
                          disabled={u.id === currentUser?.id}
                          aria-label={`Select ${u.fullName}`}
                          onCheckedChange={(v) =>
                            setSelected((prev) =>
                              v === true ? [...prev, u.id] : prev.filter((x) => x !== u.id),
                            )
                          }
                        />
                      </TableCell>
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
                            <div className="text-xs text-muted-foreground">
                              <span className="font-medium text-foreground">Joined : </span>
                              {fmtDate(u.createdAt)}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm">
                            <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            <span className="break-all">{group === "workers" ? u.username || u.email || "—" : u.email || "—"}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Phone className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{u.phone || "—"}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 text-xs text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                            <span>
                              <span className="font-medium text-foreground">Last login : </span>
                              {fmtDateTime(u.lastLoginAt)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Globe className="h-3.5 w-3.5 shrink-0" />
                            <span>
                              <span className="font-medium text-foreground">IP : </span>
                              {u.lastLoginIp ?? "—"}
                            </span>
                          </div>
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
                      <TableCell>
                        <div className="flex items-center justify-end gap-1.5">
                          {group === "workers" && workers.some(worker => worker.user_id === u.id) && <Button
                            size="icon" variant="outline" className="h-8 w-8" title="Set temporary password"
                            aria-label={`Set temporary password for ${u.fullName}`} disabled={savingId !== null}
                            onClick={() => setPasswordWorker(workers.find(worker => worker.user_id === u.id)?.id ?? null)}
                          ><KeyRound className="h-3.5 w-3.5" /></Button>}
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-8 w-8 border-primary/30 text-primary hover:bg-primary/10"
                            aria-label={`Edit ${u.fullName}`}
                            onClick={() => setEditUser(u)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-8 w-8 border-destructive/30 text-destructive hover:bg-destructive/10"
                            aria-label={`Delete ${u.fullName}`}
                            disabled={u.id === currentUser?.id}
                            onClick={() => setConfirmDelete([u.id])}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-8 w-8"
                            aria-label={u.isActive ? "Deactivate user" : "Activate user"}
                            disabled={savingId === u.id || u.id === currentUser?.id}
                            onClick={() => void toggleActive(u)}
                          >
                            <Power className="h-3.5 w-3.5" />
                          </Button>
                        </div>
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
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={credentials !== null} onOpenChange={(open) => !open && setCredentials(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{credentials?.name} — Worker login</DialogTitle><DialogDescription>Temporary password. Share privately with this worker; it will not be shown again after closing.</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <Label>Login ID</Label><Input readOnly value={credentials?.username ?? ""} />
            <Label>Temporary password</Label><Input readOnly autoComplete="off" value={credentials?.password ?? ""} />
          </div>
          <DialogFooter><Button onClick={() => setCredentials(null)}>Done</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={passwordWorker !== null} onOpenChange={(open) => !open && setPasswordWorker(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Set a new temporary password?</AlertDialogTitle><AlertDialogDescription>The current password will stop working. Share the new password privately with the worker.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => { if (passwordWorker) void setWorkerPassword(passwordWorker); }}>Set password</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AddUserDialog
        key={group}
        group={group}
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={() => void load()}
      />

      <EditUserDialog
        user={editUser}
        onOpenChange={(open) => !open && setEditUser(null)}
        onSaved={() => void load()}
      />

      <AlertDialog
        open={confirmDelete !== null}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {confirmDelete?.length ?? 0} user(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the login account and profile. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                if (confirmDelete) void runDelete(confirmDelete);
              }}
            >
              {busy ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

function AddUserDialog({
  group,
  open,
  onOpenChange,
  onCreated,
}: {
  group: AccountGroup;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<string>(group === "workers" ? "employee" : "none");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!email || password.length < 8) {
      toast.error("Email and a password of at least 8 characters are required");
      return;
    }
    setSaving(true);
    try {
      await createUser({ email, password, fullName, phone, role });
      toast.success("User created");
      setFullName("");
      setEmail("");
      setPhone("");
      setPassword("");
      setRole(group === "workers" ? "employee" : "none");
      onOpenChange(false);
      onCreated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create user");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{group === "workers" ? "Add worker app account" : "Add user"}</DialogTitle>
          <DialogDescription>{group === "workers" ? "Worker Portal login" : "New login account"}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="nu-name">Full name</Label>
            <Input id="nu-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nu-email">Email</Label>
            <Input id="nu-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nu-phone">Phone</Label>
            <Input id="nu-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nu-pass">Temporary password</Label>
            <Input
              id="nu-pass"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue />
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
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={saving}>
            {saving ? "Creating…" : "Create user"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditUserDialog({
  user,
  onOpenChange,
  onSaved,
}: {
  user: SystemUser | null;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [avatarKey, setAvatarKey] = useState<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    const name = user.fullName === "—" ? "" : user.fullName;
    const parts = name.trim().split(/\s+/).filter(Boolean);
    setFirstName(parts[0] ?? "");
    setLastName(parts.slice(1).join(" "));
    setUsername(user.username || (user.email ? user.email.split("@")[0] : ""));
    setEmail(user.email);
    setPhone(user.phone);
    setPassword("");
    setConfirmPassword("");
    setIsActive(user.isActive);
    setAvatarKey(user.avatarKey);
    setAvatarPreview(null);
  }, [user]);

  async function pickImage(file?: File) {
    if (!file) return;
    setUploading(true);
    try {
      const res = await uploadToR2(file, "avatars");
      setAvatarKey(res.key);
      setAvatarPreview(URL.createObjectURL(file));
      toast.success("Photo uploaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    if (!user) return;
    if (!firstName.trim() || !lastName.trim()) {
      toast.error("First name and last name are required");
      return;
    }
    if (!username.trim()) {
      toast.error("Username is required");
      return;
    }
    if (password && password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (password && password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setSaving(true);
    try {
      await updateUser({
        id: user.id,
        fullName: `${firstName.trim()} ${lastName.trim()}`.trim(),
        phone,
        username: username.trim(),
        email: email && email !== user.email ? email : undefined,
        password: password || undefined,
        isActive,
        avatarKey,
      });
      toast.success("User updated");
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update user");
    } finally {
      setSaving(false);
    }
  }

  const initials = (firstName || email || "U").slice(0, 2).toUpperCase();

  return (
    <Dialog open={user !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader className="border-b pb-3">
          <DialogTitle>Edit</DialogTitle>
          <DialogDescription className="sr-only">Edit user account details</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="flex items-center gap-3">
            {avatarPreview ? (
              <img
                src={avatarPreview}
                alt="Selected profile"
                className="h-16 w-16 rounded-full object-cover ring-2 ring-primary/20"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-primary text-lg font-semibold text-primary-foreground">
                {initials}
              </div>
            )}
            {uploading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="eu-first">
                First Name <span className="text-destructive">*</span>
              </Label>
              <Input id="eu-first" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eu-last">
                Last Name <span className="text-destructive">*</span>
              </Label>
              <Input id="eu-last" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eu-username">
                Username <span className="text-destructive">*</span>
              </Label>
              <Input
                id="eu-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="bg-primary/5"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eu-email">Email</Label>
              <Input
                id="eu-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eu-phone">Phone</Label>
              <Input id="eu-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eu-pass">Password</Label>
              <Input
                id="eu-pass"
                type="password"
                value={password}
                autoComplete="new-password"
                placeholder="Leave blank to keep current"
                onChange={(e) => setPassword(e.target.value)}
                className="bg-primary/5"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eu-confirm">Confirm Password</Label>
              <Input
                id="eu-confirm"
                type="password"
                value={confirmPassword}
                autoComplete="new-password"
                placeholder="Re-type Password"
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eu-image" className="font-semibold">
                Image
              </Label>
              <Input
                id="eu-image"
                type="file"
                accept="image/*"
                disabled={uploading}
                onChange={(e) => void pickImage(e.target.files?.[0])}
                className="cursor-pointer file:mr-3 file:rounded-md file:border file:bg-muted file:px-2 file:py-1 file:text-xs"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Checkbox
              id="eu-active"
              checked={isActive}
              onCheckedChange={(v) => setIsActive(v === true)}
            />
            <Label htmlFor="eu-active" className="font-normal">
              Active
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button
            className="w-full"
            size="lg"
            onClick={() => void submit()}
            disabled={saving || uploading}
          >
            {saving ? "Saving…" : "Edit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
