import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2, CalendarClock, CheckCircle2, Pencil, Plus, Trash2, Users, Wallet } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { CompanyOverviewCards } from "@/components/dashboard/company-overview-cards";
import { SummaryCard } from "@/components/ui/summary-card";
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
import { companySlug } from "@/lib/company-slug";
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

function CompaniesPage() {
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

  const money = (n: number) => `$${Math.round(n).toLocaleString("en-SG")}`;

  const groupMonthlyWage = employees.reduce((s, e) => s + (e.basicSalary || 0), 0);

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

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <SummaryCard title="Total companies" value={String(companies.length)} icon={<Building2 className="h-5 w-5" />} variant="primary" compact />
          <SummaryCard
            title="Active entities"
            value={String(companies.filter((c) => c.status === "Active").length)}
            icon={<CheckCircle2 className="h-5 w-5" />}
            variant="success"
            compact
          />
          <SummaryCard title="Total workforce" value={String(employees.length)} icon={<Users className="h-5 w-5" />} variant="info" compact />
          <SummaryCard title="Monthly basic wage estimate" value={money(groupMonthlyWage)} icon={<Wallet className="h-5 w-5" />} variant="primary" compact />
          <SummaryCard title="Annualised basic wage estimate" value={money(groupMonthlyWage * 12)} icon={<CalendarClock className="h-5 w-5" />} variant="success" compact />
        </div>

        <CompanyOverviewCards
          includeGroup={false}
          actions={(c) => {
            const company = companies.find((x) => x.id === c.id);
            if (!company) return null;
            return (
              <>
                <Button asChild size="sm" variant="default" className="gap-1">
                  <Link to="/companies/$id" params={{ id: companySlug(company) }}>Open dashboard</Link>
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
                <Button size="sm" variant="outline" className="gap-1" onClick={() => setEditing(company)}>
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
                <Button size="sm" variant="ghost" className="gap-1 text-destructive" onClick={() => setDeleteTarget(company)}>
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </Button>
              </>
            );
          }}
        />
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
