import { useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft, Building2, Briefcase, CalendarClock, ImagePlus, Mail, MapPin,
  Pencil, Phone, ShieldAlert, UserCheck, Users, Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { R2Image } from "@/components/r2-image";
import { SummaryCard } from "@/components/ui/summary-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  getCompany, updateCompany, setCurrentCompany, getCurrentCompany,
  getEmployees, getProjects, getClients, getSites, getAssignments, getLeaveRequests,
} from "@/lib/store";
import { MOM_SECTORS } from "@/lib/mom";
import { uploadToR2 } from "@/lib/r2";
import type { Company, Employee } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/companies_/$id")({
  head: () => ({
    meta: [
      { title: "Company dashboard — BSM Workforce & Operations" },
      { name: "description", content: "Entity dashboard: workforce, availability, projects, clients, payroll and compliance for a single group company." },
      { property: "og:title", content: "Company dashboard — BSM Workforce & Operations" },
      { property: "og:description", content: "Entity dashboard: workforce, availability, projects, clients, payroll and compliance for a single group company." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CompanyDashboardPage,
});

const accentBg: Record<Company["accent"], string> = {
  primary: "bg-gradient-primary",
  success: "bg-gradient-success",
  warning: "bg-gradient-warning",
  info: "bg-gradient-info",
  destructive: "bg-gradient-destructive",
};

const accents: Company["accent"][] = ["primary", "success", "warning", "info", "destructive"];

function daysUntil(iso?: string): number | null {
  if (!iso || iso === "-") return null;
  const t = new Date(`${iso}T00:00:00+08:00`).getTime();
  if (Number.isNaN(t)) return null;
  return Math.round((t - Date.now()) / 86_400_000);
}

const money = (n: number) => `$${Math.round(n).toLocaleString("en-SG")}`;

function CompanyDashboardPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [company, setCompany] = useState<Company | undefined>(() => getCompany(id));
  const [editing, setEditing] = useState(false);
  const [current, setCurrent] = useState(getCurrentCompany());

  const employees = getEmployees();
  const projects = getProjects();
  const clients = getClients();
  const sites = getSites();
  const assignments = getAssignments();
  const leaves = getLeaveRequests();

  const data = useMemo(() => {
    const staff = employees.filter((e) => (e.companyId ?? "bsm") === id);
    const staffIds = new Set(staff.map((e) => e.id));
    const today = new Date().toISOString().slice(0, 10);
    const onLeaveIds = new Set(
      leaves
        .filter((l) => l.status === "Approved" && l.startDate <= today && l.endDate >= today)
        .map((l) => l.employeeId),
    );
    const active = staff.filter((e) => e.status === "Active" || e.status === "Deployed");
    const deployedIds = new Set(
      assignments.filter((a) => a.status === "Active" && staffIds.has(a.employeeId)).map((a) => a.employeeId),
    );
    const available = active.filter((e) => !onLeaveIds.has(e.id) && !deployedIds.has(e.id));

    const projectIds = new Set(
      assignments.filter((a) => staffIds.has(a.employeeId)).map((a) => a.projectId).filter(Boolean),
    );
    const companyProjects = projects.filter((p) => projectIds.has(p.id));
    const clientIds = new Set(companyProjects.map((p) => p.clientId));
    const companyClients = clients.filter((c) => clientIds.has(c.id));

    const expiring = staff
      .map((e) => ({ e, days: daysUntil(e.passExpiry) }))
      .filter((x) => x.days !== null && (x.days as number) <= 90)
      .sort((a, b) => (a.days as number) - (b.days as number));

    const monthlyWage = active.reduce((s, e) => s + (e.basicSalary || 0), 0);

    return {
      staff, active, available, companyProjects, companyClients, expiring, monthlyWage,
      onLeave: staff.filter((e) => onLeaveIds.has(e.id)).length,
      deployed: deployedIds.size,
      siteCount: sites.filter((s) => projectIds.has(s.projectId)).length,
    };
  }, [employees, projects, clients, sites, assignments, leaves, id]);

  if (!company) {
    return (
      <AppShell>
        <EmptyState
          icon={<Building2 className="h-8 w-8" />}
          title="Company not found"
          description="This entity may have been removed."
          action={<Button onClick={() => navigate({ to: "/companies" })}>Back to companies</Button>}
        />
      </AppShell>
    );
  }

  const soonest = data.expiring[0]?.days ?? null;

  return (
    <AppShell>
      <div className="space-y-6">
        <Button asChild variant="ghost" size="sm" className="gap-1 -ml-2">
          <Link to="/companies"><ArrowLeft className="h-4 w-4" /> All companies</Link>
        </Button>

        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl border bg-gradient-surface p-6 shadow-sm">
          <div className={`absolute inset-x-0 top-0 h-1.5 ${accentBg[company.accent]}`} />
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <div
                className={`flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl text-lg font-bold text-primary-foreground shadow-elegant ${
                  company.logoUrl ? "bg-card" : accentBg[company.accent]
                }`}
              >
                <R2Image
                  src={company.logoUrl}
                  alt={`${company.name} logo`}
                  className="h-full w-full object-contain"
                  fallback={<span>{company.code}</span>}
                />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="truncate text-2xl font-semibold tracking-tight">{company.name}</h1>
                  <StatusBadge variant={company.status === "Active" ? "success" : "warning"} label={company.status} />
                  {current === company.id && <StatusBadge variant="info" dot label="Current" />}
                </div>
                <p className="truncate text-sm text-muted-foreground">{company.legalName}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  UEN {company.uen || "—"} · {company.industry || "—"} · {company.sector ?? "—"}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={current === company.id ? "secondary" : "default"}
                disabled={current === company.id}
                onClick={() => { setCurrentCompany(company.id); setCurrent(company.id); }}
              >
                {current === company.id ? "Current company" : "Set as current"}
              </Button>
              <Button size="sm" variant="outline" className="gap-1" onClick={() => setEditing(true)}>
                <Pencil className="h-3.5 w-3.5" /> Edit company
              </Button>
            </div>
          </div>

          <dl className="mt-5 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
            <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5" /> {company.address || "—"}</div>
            <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" /> {company.phone || "—"}</div>
            <div className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" /> {company.email || "—"}</div>
          </dl>
        </div>

        {/* Metrics */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <SummaryCard
            title="Total workers" value={String(data.staff.length)}
            icon={<Users className="h-5 w-5" />} variant="primary"
            caption={`${data.active.length} active`}
          />
          <SummaryCard
            title="Available workers" value={String(data.available.length)}
            icon={<UserCheck className="h-5 w-5" />} variant="success"
            badges={[
              { label: `Deployed: ${data.deployed}`, tone: "info" },
              { label: `On leave: ${data.onLeave}`, tone: data.onLeave ? "warning" : "neutral" },
            ]}
          />
          <SummaryCard
            title="Permits expiring (90d)" value={String(data.expiring.length)}
            icon={<ShieldAlert className="h-5 w-5" />}
            variant={soonest !== null && soonest <= 30 ? "destructive" : data.expiring.length ? "warning" : "success"}
            badges={soonest !== null ? [{ label: `${soonest}d left (soonest)`, tone: soonest <= 15 ? "critical" : soonest <= 30 ? "warning" : "info" }] : undefined}
          />
          <SummaryCard
            title="Projects" value={String(data.companyProjects.length)}
            icon={<Briefcase className="h-5 w-5" />} variant="info"
            caption={`${data.siteCount} sites · ${data.companyClients.length} clients`}
          />
          <SummaryCard
            title="Monthly basic wage" value={money(data.monthlyWage)}
            icon={<Wallet className="h-5 w-5" />} variant="primary" compact
          />
          <SummaryCard
            title="Annual wage" value={money(data.monthlyWage * 12)}
            icon={<CalendarClock className="h-5 w-5" />} variant="info" compact
          />
          <SummaryCard
            title="Clients" value={String(data.companyClients.length)}
            icon={<Building2 className="h-5 w-5" />} variant="success" compact
          />
          <SummaryCard
            title="On leave today" value={String(data.onLeave)}
            icon={<CalendarClock className="h-5 w-5" />} variant="warning" compact
          />
        </div>

        <Tabs defaultValue="workers" className="space-y-4">
          <TabsList>
            <TabsTrigger value="workers">Workers ({data.staff.length})</TabsTrigger>
            <TabsTrigger value="available">Available ({data.available.length})</TabsTrigger>
            <TabsTrigger value="projects">Projects ({data.companyProjects.length})</TabsTrigger>
            <TabsTrigger value="clients">Clients ({data.companyClients.length})</TabsTrigger>
            <TabsTrigger value="compliance">Compliance ({data.expiring.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="workers">
            <WorkerTable rows={data.staff} />
          </TabsContent>
          <TabsContent value="available">
            <WorkerTable rows={data.available} />
          </TabsContent>

          <TabsContent value="projects">
            <div className="rounded-xl border bg-card">
              {data.companyProjects.length === 0 ? (
                <EmptyState icon={<Briefcase className="h-8 w-8" />} title="No projects" description="No project has workers from this company yet." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead><TableHead>Project</TableHead><TableHead>Client</TableHead>
                      <TableHead>Location</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Required</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.companyProjects.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-mono text-xs">{p.code}</TableCell>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell>{clients.find((c) => c.id === p.clientId)?.name ?? "—"}</TableCell>
                        <TableCell>{p.location}</TableCell>
                        <TableCell><StatusBadge variant={p.status === "Active" ? "success" : p.status === "Completed" ? "info" : "warning"} label={p.status} /></TableCell>
                        <TableCell className="text-right tabular-nums">{p.requiredWorkers}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </TabsContent>

          <TabsContent value="clients">
            <div className="rounded-xl border bg-card">
              {data.companyClients.length === 0 ? (
                <EmptyState icon={<Building2 className="h-8 w-8" />} title="No clients" description="No client is linked through this company's deployments." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead><TableHead>Client</TableHead><TableHead>Contact</TableHead>
                      <TableHead>Phone</TableHead><TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.companyClients.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-mono text-xs">{c.code}</TableCell>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell>{c.contactPerson}</TableCell>
                        <TableCell>{c.phone}</TableCell>
                        <TableCell><StatusBadge variant={c.status === "Active" ? "success" : "warning"} label={c.status} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </TabsContent>

          <TabsContent value="compliance">
            <div className="rounded-xl border bg-card">
              {data.expiring.length === 0 ? (
                <EmptyState icon={<ShieldAlert className="h-8 w-8" />} title="All clear" description="No pass expiring in the next 90 days." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Worker</TableHead><TableHead>Pass</TableHead><TableHead>Expiry</TableHead><TableHead>Days left</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.expiring.map(({ e, days }) => (
                      <TableRow key={e.id}>
                        <TableCell className="font-medium">
                          <Link to="/workforce/$id" params={{ id: e.id }} className="hover:underline">{e.name}</Link>
                        </TableCell>
                        <TableCell>{e.passType}</TableCell>
                        <TableCell>{e.passExpiry}</TableCell>
                        <TableCell>
                          <StatusBadge
                            variant={(days as number) < 0 ? "destructive" : (days as number) <= 30 ? "warning" : "info"}
                            dot
                            label={(days as number) < 0 ? "Expired" : `${days}d`}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <EditCompanyDialog
        company={company}
        open={editing}
        onOpenChange={setEditing}
        onSaved={(c) => setCompany(c)}
      />
    </AppShell>
  );
}

function WorkerTable({ rows }: { rows: Employee[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border bg-card">
        <EmptyState icon={<Users className="h-8 w-8" />} title="No workers" description="No employee matches this view." />
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Trade</TableHead>
            <TableHead>Pass</TableHead><TableHead>Expiry</TableHead><TableHead>Status</TableHead>
            <TableHead className="text-right">Basic</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((e) => (
            <TableRow key={e.id}>
              <TableCell className="font-mono text-xs">{e.employeeCode}</TableCell>
              <TableCell className="font-medium">
                <Link to="/workforce/$id" params={{ id: e.id }} className="hover:underline">{e.name}</Link>
              </TableCell>
              <TableCell>{e.trade}</TableCell>
              <TableCell>{e.passType}</TableCell>
              <TableCell>{e.passExpiry}</TableCell>
              <TableCell><StatusBadge variant={e.status === "Active" || e.status === "Deployed" ? "success" : "warning"} label={e.status} /></TableCell>
              <TableCell className="text-right tabular-nums">{money(e.basicSalary || 0)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function EditCompanyDialog({
  company, open, onOpenChange, onSaved,
}: {
  company: Company;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: (c: Company) => void;
}) {
  const [logoUrl, setLogoUrl] = useState<string | undefined>(company.logoUrl);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function pickLogo(file?: File) {
    if (!file) return;
    setUploading(true);
    try {
      const res = await uploadToR2(file, "logos");
      setLogoUrl(res.key);
      toast.success("Logo uploaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const updated = updateCompany(company.id, {
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
              logoUrl: logoUrl || undefined,
            });
            if (updated) onSaved(updated);
            toast.success("Company updated");
            onOpenChange(false);
          }}
        >
          <DialogHeader>
            <DialogTitle>Edit {company.name}</DialogTitle>
            <DialogDescription>Update entity details, branding and MOM sector.</DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-4 py-4">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl border bg-muted text-sm font-bold">
              <R2Image src={logoUrl} alt="Company logo" className="h-full w-full object-contain" fallback={<span>{company.code}</span>} />
            </div>
            <div className="space-y-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => pickLogo(e.target.files?.[0])}
              />
              <Button type="button" variant="outline" size="sm" className="gap-1" disabled={uploading} onClick={() => fileRef.current?.click()}>
                <ImagePlus className="h-4 w-4" /> {uploading ? "Uploading…" : "Upload logo"}
              </Button>
              {logoUrl && (
                <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => setLogoUrl(undefined)}>
                  Remove logo
                </Button>
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="code">Short code</Label>
              <Input id="code" name="code" required maxLength={5} defaultValue={company.code} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="name">Display name</Label>
              <Input id="name" name="name" required defaultValue={company.name} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="legalName">Legal name</Label>
              <Input id="legalName" name="legalName" required defaultValue={company.legalName} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="uen">UEN</Label>
              <Input id="uen" name="uen" defaultValue={company.uen} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="industry">Industry</Label>
              <Input id="industry" name="industry" defaultValue={company.industry} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sector">MOM sector</Label>
              <Select name="sector" defaultValue={company.sector ?? "Construction"}>
                <SelectTrigger id="sector"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MOM_SECTORS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="status">Status</Label>
              <Select name="status" defaultValue={company.status}>
                <SelectTrigger id="status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="address">Address</Label>
              <Input id="address" name="address" defaultValue={company.address} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" defaultValue={company.phone} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" defaultValue={company.email} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="accent">Accent colour</Label>
              <Select name="accent" defaultValue={company.accent}>
                <SelectTrigger id="accent"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {accents.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button type="submit">Save changes</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}