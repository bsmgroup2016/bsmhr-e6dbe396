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
  getCompanies, updateCompany, setCurrentCompany, getCurrentCompany,
  getEmployees, getProjects, getClients, getSites, getAssignments, getLeaveRequests,
} from "@/lib/store";
import { findCompanyByParam } from "@/lib/company-slug";
import { MOM_SECTORS } from "@/lib/mom";
import { uploadToR2 } from "@/lib/r2";
import { employeeSlugById } from "@/lib/employee-slug";
import type { Company, Employee } from "@/lib/types";
import { companyOverview, CSOC_RE } from "@/core/company-overview";
import { CompanyOverviewCards } from "@/components/dashboard/company-overview-cards";
import { getCertifications, getPayroll } from "@/lib/store";

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
  const { id: param } = Route.useParams();
  const navigate = useNavigate();
  const [savedCompany, setCompany] = useState<Company | undefined>(() =>
    findCompanyByParam(getCompanies(), param),
  );
  const isGroup = param === "group";
  const resolvedCompany = findCompanyByParam(getCompanies(), param);
  const company: Company | undefined = isGroup ? {
    id: "group", code: "BSM", name: "BSM Group", legalName: "All group companies",
    uen: "", industry: "", address: "", phone: "", email: "", status: "Active",
    accent: "primary", createdAt: "", updatedAt: "",
  } : savedCompany?.id === resolvedCompany?.id ? savedCompany : resolvedCompany;
  const id = company?.id ?? param;
  const [editing, setEditing] = useState(false);
  const [current, setCurrent] = useState(getCurrentCompany());

  const employees = getEmployees();
  const projects = getProjects();
  const clients = getClients();
  const sites = getSites();
  const assignments = getAssignments();
  const leaves = getLeaveRequests();
  const overview = companyOverview(employees, getCertifications(), getPayroll(), isGroup ? undefined : id);

  const data = useMemo(() => {
    const staff = employees.filter((e) => isGroup || e.companyId === id);
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
    const companyProjects = projects.filter((p) => isGroup || projectIds.has(p.id));
    const clientIds = new Set(companyProjects.map((p) => p.clientId));
    const companyClients = clients.filter((c) => isGroup || clientIds.has(c.id));

    const expiring = staff
      .map((e) => ({ e, days: daysUntil(e.passExpiry) }))
      .filter((x) => x.days !== null && (x.days as number) <= 90)
      .sort((a, b) => (a.days as number) - (b.days as number));

    const monthlyWage = active.reduce((s, e) => s + (e.basicSalary || 0), 0);

    return {
      staff, active, available, companyProjects, companyClients, expiring, monthlyWage,
      onLeave: staff.filter((e) => onLeaveIds.has(e.id)).length,
      deployed: deployedIds.size,
      siteCount: sites.filter((s) => isGroup || projectIds.has(s.projectId)).length,
    };
  }, [employees, projects, clients, sites, assignments, leaves, id, isGroup]);

  if (!company) {
    return (
      <AppShell>
        <EmptyState
          icon={<Building2 className="h-8 w-8" />}
          title="Company not found"
          description="This entity may have been removed."
          action={{ label: "Back to companies", onClick: () => navigate({ to: "/companies" }) }}
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
        <div className="border-b pb-6">
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
                  <h1 className="break-words text-2xl font-semibold">{company.name}</h1>
                  <StatusBadge variant={company.status === "Active" ? "success" : "warning"} label={company.status} />
                  {current === company.id && <StatusBadge variant="info" dot label="Current" />}
                </div>
                <p className="truncate text-sm text-muted-foreground">{company.legalName}</p>
                {!isGroup && <p className="mt-1 text-xs text-muted-foreground">
                  UEN {company.uen || "—"} · {company.industry || "—"} · {company.sector ?? "—"}
                </p>}
              </div>
            </div>
            {!isGroup && <div className="flex flex-wrap gap-2">
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
            </div>}
          </div>

          {!isGroup && <dl className="mt-5 grid gap-2 break-words text-xs text-muted-foreground sm:grid-cols-3 [&_svg]:shrink-0">
            <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5" /> {company.address || "—"}</div>
            <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" /> {company.phone || "—"}</div>
            <div className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" /> {company.email || "—"}</div>
          </dl>}
        </div>

        {isGroup && <CompanyOverviewCards />}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard title="Waiting for issuance" value={String(overview.waiting.length)} icon={<CalendarClock className="h-5 w-5" />} variant="warning" caption="IPA issued / arrived / medical cleared" />
          <SummaryCard title="Work Permit expiring" value={String(overview.permits.length)} icon={<ShieldAlert className="h-5 w-5" />} variant="destructive" caption="Confirmed expiry · next 60 days" />
          <SummaryCard title="CSOC expiring" value={String(overview.csoc.length)} icon={<ShieldAlert className="h-5 w-5" />} variant="info" caption="Next 60 days · unique workers" />
          <SummaryCard title="Annual wages" value={money(overview.annualWages)} icon={<Wallet className="h-5 w-5" />} variant="primary" caption={`Recorded gross wages · ${overview.year} YTD`} />
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
            title="Expired / expiring permits (90d)" value={String(data.expiring.length)}
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
            title="Annualised basic wage estimate" value={money(data.monthlyWage * 12)}
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
          <TabsList className="h-auto flex flex-wrap justify-start">
            <TabsTrigger value="workers">Workers ({data.staff.length})</TabsTrigger>
            <TabsTrigger value="available">Available ({data.available.length})</TabsTrigger>
            <TabsTrigger value="projects">Projects ({data.companyProjects.length})</TabsTrigger>
            <TabsTrigger value="clients">Clients ({data.companyClients.length})</TabsTrigger>
            <TabsTrigger value="compliance">Compliance ({data.expiring.length})</TabsTrigger>
            <TabsTrigger value="issuance">Waiting for issuance ({overview.waiting.length})</TabsTrigger>
            <TabsTrigger value="csoc">CSOC expiring ({overview.csoc.length})</TabsTrigger>
            <TabsTrigger value="wages">Annual wages</TabsTrigger>
          </TabsList>

          <TabsContent value="workers">
            <WorkerTable rows={data.staff} />
          </TabsContent>
          <TabsContent value="available">
            <WorkerTable rows={data.available} />
          </TabsContent>
          <TabsContent value="issuance"><WorkerTable rows={overview.waiting} /></TabsContent>
          <TabsContent value="csoc">
            <div className="overflow-x-auto rounded-lg border bg-card">
              <Table><TableHeader><TableRow><TableHead>Worker</TableHead><TableHead>P-File</TableHead><TableHead>CSOC expiry</TableHead></TableRow></TableHeader>
                <TableBody>{overview.csoc.map((e) => {
                  const dates = [e.safetyCourseExpiry, ...getCertifications().filter((c) => c.employeeId === e.id && CSOC_RE.test(c.courseName)).map((c) => c.expiryDate)].filter((date): date is string => Boolean(date));
                  return <TableRow key={e.id}><TableCell><Link to="/workforce/$slug" params={{ slug: employeeSlugById(e.id) }}>{e.name}</Link></TableCell><TableCell>{e.employeeCode}</TableCell><TableCell>{[...new Set(dates)].sort().join(" · ")}</TableCell></TableRow>;
                })}{overview.csoc.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">No CSOC expiring in the next 60 days</TableCell></TableRow>}</TableBody>
              </Table>
            </div>
          </TabsContent>
          <TabsContent value="wages">
            <div className="overflow-x-auto rounded-lg border bg-card">
              <Table><TableHeader><TableRow><TableHead>Month</TableHead><TableHead>Worker</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Gross wages</TableHead></TableRow></TableHeader>
                <TableBody>{overview.annualPayroll.map((p) => <TableRow key={p.id}><TableCell>{p.month}</TableCell><TableCell>{employees.find((e) => e.id === p.employeeId)?.name ?? "—"}</TableCell><TableCell>{p.status}</TableCell><TableCell className="text-right tabular-nums">{money(p.basicSalary + p.overtimePay + p.allowances + (p.bonus ?? 0))}</TableCell></TableRow>)}
                {overview.annualPayroll.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No payroll recorded for {overview.year}</TableCell></TableRow>}
                <TableRow><TableCell colSpan={3} className="font-semibold">Total · {overview.year}</TableCell><TableCell className="text-right font-semibold">{money(overview.annualWages)}</TableCell></TableRow></TableBody>
              </Table>
            </div>
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
                          <Link to="/workforce/$slug" params={{ slug: employeeSlugById(e.id) }} className="hover:underline">{e.name}</Link>
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

      {!isGroup && <EditCompanyDialog
        company={company}
        open={editing}
        onOpenChange={setEditing}
        onSaved={(c) => setCompany(c)}
      />}
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
            <TableHead>P-File No</TableHead><TableHead>Name</TableHead><TableHead>Designation</TableHead>
            <TableHead>Pass</TableHead><TableHead>Expiry</TableHead><TableHead>Status</TableHead>
            <TableHead className="text-right">Basic</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((e) => (
            <TableRow key={e.id}>
              <TableCell className="font-mono text-xs">{e.employeeCode}</TableCell>
              <TableCell className="font-medium">
                <Link to="/workforce/$slug" params={{ slug: employeeSlugById(e.id) }} className="hover:underline">{e.name}</Link>
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