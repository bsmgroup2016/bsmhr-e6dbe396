import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Plus,
  Search,
  User as UserIcon,
  Shield,
  MoreHorizontal,
  Pencil,
  CheckCircle2,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { SummaryCard } from "@/components/ui/summary-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getUsers } from "@/lib/store";
import type { User, AppRole } from "@/lib/types";

const roles: AppRole[] = ["admin", "manager", "supervisor", "client", "hr", "payroll"];

export const Route = createFileRoute("/users")({
  head: () => ({
    meta: [
      { title: "Users — BSM Workforce & Operations" },
      { name: "description", content: "Manage system users and roles." },
      { property: "og:title", content: "Users — BSM Workforce & Operations" },
      { property: "og:description", content: "Manage system users and roles." },
    ],
  }),
  component: UsersPage,
});

export default function UsersPage() {
  const [users, setUsers] = useState(getUsers());
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<AppRole | "all">("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return (u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)) && (roleFilter === "all" || u.role === roleFilter);
  });

  const activeCount = users.filter((u) => u.status === "active").length;
  const adminCount = users.filter((u) => u.role === "admin").length;

  function refresh() {
    setUsers(getUsers());
  }

  function handleCreate(formData: FormData) {
    const newUser: User = {
      id: `u${users.length + 1}`,
      name: formData.get("name") as string,
      email: formData.get("email") as string,
      role: formData.get("role") as AppRole,
      status: "active",
      branch: (formData.get("branch") as string) || undefined,
      createdAt: new Date().toISOString().split("T")[0],
    };
    setUsers([...users, newUser]);
    setIsCreateOpen(false);
  }

  function handleEdit(formData: FormData) {
    if (!editingUser) return;
    const updated = users.map((u) =>
      u.id === editingUser.id
        ? {
            ...u,
            name: formData.get("name") as string,
            email: formData.get("email") as string,
            role: formData.get("role") as AppRole,
            status: formData.get("status") as "active" | "inactive",
            branch: (formData.get("branch") as string) || u.branch,
          }
        : u,
    );
    setUsers(updated);
    setEditingUser(null);
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Users</h1>
            <p className="text-sm text-muted-foreground">System users and roles.</p>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="mt-2 sm:mt-0">
                <Plus className="mr-1 h-4 w-4" />
                Add user
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add user</DialogTitle>
                <DialogDescription>Create a new system user.</DialogDescription>
              </DialogHeader>
              <UserForm onSubmit={handleCreate} />
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard title="Total users" value={users.length.toString()} icon={<UserIcon className="h-5 w-5" />} variant="primary" caption="System accounts" />
          <SummaryCard title="Active" value={activeCount.toString()} icon={<CheckCircle2 className="h-5 w-5" />} variant="success" caption="Can log in" />
          <SummaryCard title="Admins" value={adminCount.toString()} icon={<Shield className="h-5 w-5" />} variant="warning" caption="Full access" />
          <SummaryCard title="Roles" value={roles.length.toString()} icon={<Shield className="h-5 w-5" />} variant="info" caption="Role types" />
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input type="search" placeholder="Search users..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as AppRole | "all")}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                {roles.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="mt-4 overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center">
                      <EmptyState className="bg-transparent border-0" icon={<UserIcon className="h-5 w-5" />} title="No users found" description="Add a user to get started." />
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.name}</TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell className="capitalize">{u.role}</TableCell>
                      <TableCell>{u.branch || "—"}</TableCell>
                      <TableCell>
                        <StatusBadge variant={u.status === "active" ? "success" : "ghost"} label={u.status} dot />
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setEditingUser(u)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit user</DialogTitle>
              <DialogDescription>Update user details.</DialogDescription>
            </DialogHeader>
            {editingUser && <UserForm user={editingUser} onSubmit={handleEdit} />}
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}

function UserForm({ user, onSubmit }: { user?: User; onSubmit: (data: FormData) => void }) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(new FormData(e.currentTarget));
      }}
      className="space-y-4"
    >
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" defaultValue={user?.name} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" defaultValue={user?.email} required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="role">Role</Label>
          <Select name="role" defaultValue={user?.role || "manager"}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {roles.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select name="status" defaultValue={user?.status || "active"}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">active</SelectItem>
              <SelectItem value="inactive">inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="branch">Branch</Label>
        <Input id="branch" name="branch" defaultValue={user?.branch} />
      </div>
      <DialogFooter>
        <Button type="submit">{user ? "Save changes" : "Add user"}</Button>
      </DialogFooter>
    </form>
  );
}
