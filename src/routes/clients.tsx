import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  Eye,
  Building2,
  Phone,
  Mail,
  MapPin,
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { getClients, getProjects, addClient, updateClient, deleteClient } from "@/lib/store";
import type { Client, ClientStatus } from "@/lib/types";

const statuses: ClientStatus[] = ["Active", "Inactive", "Prospect"];
const industries = ["Construction", "Petrochemical", "Aviation", "Utilities", "Manufacturing", "Marine", "Other"];

export const Route = createFileRoute("/clients")({
  head: () => ({
    meta: [
      { title: "Clients — BSM Workforce & Operations" },
      { name: "description", content: "Manage BSM Engineering client companies." },
      { property: "og:title", content: "Clients — BSM Workforce & Operations" },
      { property: "og:description", content: "Manage BSM Engineering client companies." },
    ],
  }),
  component: ClientsPage,
});

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>(getClients());
  const [projects] = useState(getProjects());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ClientStatus | "all">("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [viewingClient, setViewingClient] = useState<Client | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);

  const filtered = clients.filter((c) => {
    const q = search.toLowerCase();
    const matchesSearch =
      c.name.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q) ||
      c.contactPerson.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q);
    return matchesSearch && (statusFilter === "all" || c.status === statusFilter);
  });

  const activeCount = clients.filter((c) => c.status === "Active").length;
  const prospectCount = clients.filter((c) => c.status === "Prospect").length;
  const totalContractValue = projects.reduce((sum, p) => sum + p.requiredWorkers * 2500, 0);

  function refresh() {
    setClients(getClients());
  }

  function handleCreate(formData: FormData) {
    addClient({
      name: formData.get("name") as string,
      contactPerson: formData.get("contactPerson") as string,
      email: formData.get("email") as string,
      phone: formData.get("phone") as string,
      address: formData.get("address") as string,
      status: formData.get("status") as ClientStatus,
      industry: formData.get("industry") as string,
      contractStart: (formData.get("contractStart") as string) || undefined,
      contractEnd: (formData.get("contractEnd") as string) || undefined,
    });
    setIsCreateOpen(false);
    refresh();
  }

  function handleEdit(formData: FormData) {
    if (!editingClient) return;
    updateClient(editingClient.id, {
      name: formData.get("name") as string,
      contactPerson: formData.get("contactPerson") as string,
      email: formData.get("email") as string,
      phone: formData.get("phone") as string,
      address: formData.get("address") as string,
      status: formData.get("status") as ClientStatus,
      industry: formData.get("industry") as string,
      contractStart: (formData.get("contractStart") as string) || undefined,
      contractEnd: (formData.get("contractEnd") as string) || undefined,
    });
    setEditingClient(null);
    refresh();
  }

  function handleDelete() {
    if (!deleteTarget) return;
    deleteClient(deleteTarget.id);
    setDeleteTarget(null);
    refresh();
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Clients</h1>
            <p className="text-sm text-muted-foreground">Client companies and contracts.</p>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="mt-2 sm:mt-0">
                <Plus className="mr-1 h-4 w-4" />
                Add client
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
              <DialogHeader>
                <DialogTitle>Add new client</DialogTitle>
                <DialogDescription>Enter client company details.</DialogDescription>
              </DialogHeader>
              <ClientForm onSubmit={handleCreate} />
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard title="Total clients" value={clients.length.toString()} icon={<Building2 className="h-5 w-5" />} variant="primary" caption="All clients" />
          <SummaryCard title="Active clients" value={activeCount.toString()} icon={<Building2 className="h-5 w-5" />} variant="success" caption="Under contract" />
          <SummaryCard title="Prospects" value={prospectCount.toString()} icon={<Building2 className="h-5 w-5" />} variant="warning" caption="Potential clients" />
          <SummaryCard title="Est. contract value" value={`S$${(totalContractValue / 1000).toFixed(0)}k`} icon={<Building2 className="h-5 w-5" />} variant="info" caption="Based on workers" />
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input type="search" placeholder="Search clients..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as ClientStatus | "all")}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                {statuses.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="mt-4 overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Industry</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Projects</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center">
                      <EmptyState className="bg-transparent border-0" icon={<Building2 className="h-5 w-5" />} title="No clients found" description="Add a client to get started." />
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((c) => {
                    const projectCount = projects.filter((p) => p.clientId === c.id).length;
                    return (
                      <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setViewingClient(c)}>
                        <TableCell className="font-medium">{c.code}</TableCell>
                        <TableCell>{c.name}</TableCell>
                        <TableCell>{c.contactPerson}</TableCell>
                        <TableCell>{c.industry || "—"}</TableCell>
                        <TableCell>
                          <StatusBadge
                            variant={c.status === "Active" ? "success" : c.status === "Prospect" ? "warning" : "ghost"}
                            label={c.status}
                            dot
                          />
                        </TableCell>
                        <TableCell>{projectCount}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(evt) => evt.stopPropagation()}>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setViewingClient(c)}>
                                <Eye className="mr-2 h-4 w-4" />
                                View
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setEditingClient(c)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget(c)}>
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <Dialog open={!!editingClient} onOpenChange={(open) => !open && setEditingClient(null)}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Edit client</DialogTitle>
              <DialogDescription>Update client details for {editingClient?.code}.</DialogDescription>
            </DialogHeader>
            {editingClient && <ClientForm client={editingClient} onSubmit={handleEdit} />}
          </DialogContent>
        </Dialog>

        <Sheet open={!!viewingClient} onOpenChange={(open) => !open && setViewingClient(null)}>
          <SheetContent className="sm:max-w-lg overflow-y-auto">
            <SheetHeader>
              <SheetTitle>{viewingClient?.name}</SheetTitle>
              <SheetDescription>{viewingClient?.code}</SheetDescription>
            </SheetHeader>
            {viewingClient && (
              <div className="mt-6 space-y-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <DetailItem label="Contact person" value={viewingClient.contactPerson} />
                  <DetailItem label="Email" value={viewingClient.email} />
                  <DetailItem label="Phone" value={viewingClient.phone} />
                  <DetailItem label="Industry" value={viewingClient.industry || "—"} />
                  <DetailItem label="Contract start" value={viewingClient.contractStart || "—"} />
                  <DetailItem label="Contract end" value={viewingClient.contractEnd || "—"} />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Address</Label>
                  <p className="text-sm text-foreground flex items-start gap-2">
                    <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
                    {viewingClient.address}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Projects</Label>
                  <div className="space-y-2">
                    {projects.filter((p) => p.clientId === viewingClient.id).length === 0 ? (
                      <p className="text-sm text-muted-foreground">No projects yet.</p>
                    ) : (
                      projects
                        .filter((p) => p.clientId === viewingClient.id)
                        .map((p) => (
                          <div key={p.id} className="flex items-center justify-between rounded-lg border p-3">
                            <div>
                              <p className="text-sm font-medium">{p.name}</p>
                              <p className="text-xs text-muted-foreground">{p.location}</p>
                            </div>
                            <StatusBadge variant={p.status === "Active" ? "success" : p.status === "Planning" ? "warning" : "ghost"} label={p.status} />
                          </div>
                        ))
                    )}
                  </div>
                </div>
                <Button onClick={() => { setViewingClient(null); setEditingClient(viewingClient); }}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit client
                </Button>
              </div>
            )}
          </SheetContent>
        </Sheet>

        <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Delete client?</DialogTitle>
              <DialogDescription>
                This will permanently remove {deleteTarget?.name} ({deleteTarget?.code}). This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <Button variant="destructive" onClick={handleDelete}>Delete</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}

function ClientForm({ client, onSubmit }: { client?: Client; onSubmit: (data: FormData) => void }) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(new FormData(e.currentTarget));
      }}
      className="space-y-4"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Company name</Label>
          <Input id="name" name="name" defaultValue={client?.name} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contactPerson">Contact person</Label>
          <Input id="contactPerson" name="contactPerson" defaultValue={client?.contactPerson} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" defaultValue={client?.email} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" name="phone" defaultValue={client?.phone} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="industry">Industry</Label>
          <Select name="industry" defaultValue={client?.industry || industries[0]}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {industries.map((i) => (
                <SelectItem key={i} value={i}>
                  {i}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select name="status" defaultValue={client?.status || "Active"}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statuses.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="contractStart">Contract start</Label>
          <Input id="contractStart" name="contractStart" type="date" defaultValue={client?.contractStart} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contractEnd">Contract end</Label>
          <Input id="contractEnd" name="contractEnd" type="date" defaultValue={client?.contractEnd} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="address">Address</Label>
        <Input id="address" name="address" defaultValue={client?.address} required />
      </div>
      <DialogFooter>
        <Button type="submit">{client ? "Save changes" : "Add client"}</Button>
      </DialogFooter>
    </form>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Label className="text-muted-foreground">{label}</Label>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}
