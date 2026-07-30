import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Building2, CheckCircle2, Mail, MapPin, Pencil, Phone, Plus, Trash2, Users } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { R2Image } from "@/components/r2-image";
import { SummaryCard } from "@/components/ui/summary-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getCompanies,
  getCurrentCompany,
  setCurrentCompany,
  addCompany,
  updateCompany,
  deleteCompany,
  getEmployees,
} from "@/lib/store";
import type { Company } from "@/lib/types";
import { MOM_SECTORS } from "@/lib/mom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DepartmentsPanel, DesignationsPanel } from "@/components/org/org-structure";

export const Route = createFileRoute("/_authenticated/companies")({
  head: () => ({
    meta: [
      { title: "Companies — BSM Workforce & Operations" },
      { name: "description", content: "Manage BSM, VRL and Pluto group companies, entity details and active workforce." },
      { property: "og:title", content: "Companies — BSM Workforce & Operations" },
      { property: "og:description", content: "Manage BSM, VRL and Pluto group companies, entity details and active workforce." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CompaniesPage,
});

const accents: Company["accent"][] = ["primary", "success", "warning", "info", "destructive"];

const accentBg: Record<Company["accent"], string> = {
  primary: "bg-gradient-primary",
  success: "bg-gradient-success",
  warning: "bg-gradient-warning",
  info: "bg-gradient-info",
  destructive: "bg-gradient-destructive",
};

function CompaniesPage() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<Company[]>(getCompanies());
  const [active, setActive] = useState<string>(getCurrentCompany());
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Company | null>(null);
  const employees = getEmployees();

  function refresh() {
    setCompanies(getCompanies());
    setActive(getCurrentCompany());
  }

  function headcount(id: string) {
    return employees.filter((e) => (e.companyId ?? "bsm") === id).length;
  }

  function readForm(fd: FormData) {
    return {
      code: (fd.get("code") as string).toUpperCase(),
      name: fd.get("name") as string,
      legalName: fd.get("legalName") as string,
      uen: fd.get("uen") as string,
      industry: fd.get("industry") as string,
      sector: fd.get("sector") as string,
      address: fd.get("address") as string,
      phone: fd.get("phone") as string,
      email: fd.get("email") as string,
      status: fd.get("status") as Company["status"],
      accent: fd.get("accent") as Company["accent"],
    };
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Companies</h1>
            <p className="text-sm text-muted-foreground">Group entities, departments and designations in one place.</p>
          </div>
        </div>

        <Tabs defaultValue="companies" className="space-y-6">
          <TabsList>
            <TabsTrigger value="companies">Companies</TabsTrigger>
            <TabsTrigger value="departments">Departments</TabsTrigger>
            <TabsTrigger value="designations">Designations</TabsTrigger>
          </TabsList>

          <TabsContent value="companies" className="space-y-6">
        <div className="flex justify-end">
          <Button onClick={() => setIsCreateOpen(true)} className="gap-1">
            <Plus className="h-4 w-4" /> Add company
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SummaryCard title="Total companies" value={String(companies.length)} icon={<Building2 className="h-5 w-5" />} variant="primary" compact />
          <SummaryCard
            title="Active entities"
            value={String(companies.filter((c) => c.status === "Active").length)}
            icon={<CheckCircle2 className="h-5 w-5" />}
            variant="success"
            compact
          />
          <SummaryCard title="Total workforce" value={String(employees.length)} icon={<Users className="h-5 w-5" />} variant="info" compact />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {companies.map((c) => (
            <div
              key={c.id}
              role="link"
              tabIndex={0}
              onClick={() => navigate({ to: "/companies/$id", params: { id: c.id } })}
              onKeyDown={(e) => {
                if (e.key === "Enter") navigate({ to: "/companies/$id", params: { id: c.id } });
              }}
              className={`relative cursor-pointer overflow-hidden rounded-xl border bg-gradient-surface p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-elegant ${
                active === c.id ? "ring-2 ring-primary/60" : ""
              }`}
            >
              <div className={`absolute inset-x-0 top-0 h-1 ${accentBg[c.accent]}`} />
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-11 w-11 items-center justify-center overflow-hidden rounded-lg text-sm font-bold text-primary-foreground shadow-elegant ${
                      c.logoUrl ? "bg-card" : accentBg[c.accent]
                    }`}
                  >
                    <R2Image src={c.logoUrl} alt={`${c.name} logo`} className="h-full w-full object-contain" fallback={<span>{c.code}</span>} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold hover:underline">{c.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{c.legalName}</p>
                  </div>
                </div>
                <StatusBadge variant={c.status === "Active" ? "success" : "warning"} label={c.status} />
              </div>

              <dl className="mt-4 space-y-1.5 text-xs text-muted-foreground">
                <div className="flex items-center gap-2"><Building2 className="h-3.5 w-3.5" /> UEN {c.uen} · {c.industry}</div>
                <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5" /> {c.address}</div>
                <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" /> {c.phone}</div>
                <div className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" /> {c.email}</div>
                <div className="flex items-center gap-2"><Users className="h-3.5 w-3.5" /> {headcount(c.id)} employees</div>
              </dl>

              <div className="mt-4 flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                <Button asChild size="sm" variant="default" className="gap-1">
                  <Link to="/companies/$id" params={{ id: c.id }}>Open dashboard</Link>
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={active === c.id}
                  onClick={() => {
                    setCurrentCompany(c.id);
                    refresh();
                  }}
                >
                  {active === c.id ? "Current company" : "Set as current"}
                </Button>
                <Button size="sm" variant="outline" className="gap-1" onClick={() => setEditing(c)}>
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
                <Button size="sm" variant="ghost" className="gap-1 text-destructive" onClick={() => setDeleteTarget(c)}>
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
          </TabsContent>

          <TabsContent value="departments">
            <DepartmentsPanel companyId={active} />
          </TabsContent>

          <TabsContent value="designations">
            <DesignationsPanel companyId={active} />
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-lg">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              addCompany(readForm(new FormData(e.currentTarget)));
              setIsCreateOpen(false);
              refresh();
            }}
          >
            <DialogHeader>
              <DialogTitle>Add company</DialogTitle>
              <DialogDescription>Register a new group entity.</DialogDescription>
            </DialogHeader>
            <CompanyFields />
            <DialogFooter>
              <Button type="submit">Create</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (editing) updateCompany(editing.id, readForm(new FormData(e.currentTarget)));
              setEditing(null);
              refresh();
            }}
          >
            <DialogHeader>
              <DialogTitle>Edit company</DialogTitle>
              <DialogDescription>Update entity details.</DialogDescription>
            </DialogHeader>
            <CompanyFields company={editing ?? undefined} />
            <DialogFooter>
              <Button type="submit">Save changes</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete company</DialogTitle>
            <DialogDescription>
              {deleteTarget?.name} will be removed. Employee records stay in the system.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteTarget) deleteCompany(deleteTarget.id);
                setDeleteTarget(null);
                refresh();
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function CompanyFields({ company }: { company?: Company }) {
  return (
    <div className="grid gap-3 py-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="code">Short code</Label>
        <Input id="code" name="code" required maxLength={5} defaultValue={company?.code} placeholder="BSM" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="name">Display name</Label>
        <Input id="name" name="name" required defaultValue={company?.name} />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="legalName">Legal name</Label>
        <Input id="legalName" name="legalName" required defaultValue={company?.legalName} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="uen">UEN</Label>
        <Input id="uen" name="uen" defaultValue={company?.uen} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="industry">Industry</Label>
        <Input id="industry" name="industry" defaultValue={company?.industry} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="sector">MOM sector (levy & quota)</Label>
        <Select name="sector" defaultValue={company?.sector ?? "Construction"}>
          <SelectTrigger id="sector"><SelectValue /></SelectTrigger>
          <SelectContent>
            {MOM_SECTORS.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="address">Address</Label>
        <Input id="address" name="address" defaultValue={company?.address} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="phone">Phone</Label>
        <Input id="phone" name="phone" defaultValue={company?.phone} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" defaultValue={company?.email} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="status">Status</Label>
        <Select name="status" defaultValue={company?.status ?? "Active"}>
          <SelectTrigger id="status"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Active">Active</SelectItem>
            <SelectItem value="Inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="accent">Accent colour</Label>
        <Select name="accent" defaultValue={company?.accent ?? "primary"}>
          <SelectTrigger id="accent"><SelectValue /></SelectTrigger>
          <SelectContent>
            {accents.map((a) => (
              <SelectItem key={a} value={a}>{a}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
