import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Clock, ShieldCheck, ShieldAlert, BadgeCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { companyOverview, orderedCompanies } from "@/core/company-overview";
import { getCompanies, getEmployees, getCertifications, getPayroll } from "@/lib/store";
import { employeeSlugById } from "@/lib/employee-slug";

export function CompanyCompliance({ companyId }: { companyId?: string }) {
  const [selected, setSelected] = useState("group");
  const [category, setCategory] = useState("waiting");
  const companies = orderedCompanies(getCompanies());
  const scope = companyId ?? selected;
  const data = companyOverview(getEmployees(), getCertifications(), getPayroll(), scope === "group" ? undefined : scope);
  const name = scope === "group" ? "BSM Group" : companies.find((c) => c.id === scope)?.name ?? "Company";
  const metrics = [
    { id: "waiting", label: "Waiting for issuance", rows: data.waiting, icon: Clock, tone: "text-warning-text", bg: "bg-warning/10", caption: "IPA / arrived / medical cleared" },
    { id: "live", label: "Live Work Permits", rows: data.livePermits, icon: ShieldCheck, tone: "text-success", bg: "bg-success/10", caption: "Issued · confirmed valid expiry" },
    { id: "expired", label: "Expired Work Permits", rows: data.expiredPermits, icon: ShieldAlert, tone: "text-destructive", bg: "bg-destructive/10", caption: "Confirmed expiry before today" },
    { id: "expiring", label: "Work Permit expiring", rows: data.permits, icon: ShieldAlert, tone: "text-warning-text", bg: "bg-warning/10", caption: "Next 60 days" },
    { id: "csoc", label: "CSOC expiring", rows: data.csoc, icon: BadgeCheck, tone: "text-info", bg: "bg-info/10", caption: "Next 60 days · unique workers" },
  ];
  const current = metrics.find((m) => m.id === category) ?? metrics[0];
  return <section aria-label="Onboarding and compliance" className="space-y-4">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><h2 className="text-lg font-semibold">Onboarding & compliance</h2><p className="mt-1 text-sm text-muted-foreground">{name} · {data.workers.length} workers</p></div>
      <Button asChild variant="outline" size="sm"><Link to="/companies/$id" params={{ id: scope }}>Company details<ArrowUpRight /></Link></Button>
    </div>
    {!companyId && <Tabs value={selected} onValueChange={setSelected}><TabsList aria-label="Compliance company" className="h-auto"><TabsTrigger value="group">BSM Group</TabsTrigger>{companies.map((c) => <TabsTrigger key={c.id} value={c.id}>{c.name}</TabsTrigger>)}</TabsList></Tabs>}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {metrics.map((metric) => <Button key={metric.id} variant="outline" aria-pressed={category === metric.id} onClick={() => setCategory(metric.id)} className={`h-auto min-h-36 min-w-0 flex-col items-start gap-2 whitespace-normal rounded-lg p-4 text-left ${category === metric.id ? "border-primary ring-1 ring-primary" : "border-border"} ${metric.bg}`}>
        <span className="flex w-full items-center justify-between"><metric.icon className={`size-5 ${metric.tone}`} /><span className={`text-3xl font-bold tabular-nums ${metric.tone}`}>{metric.rows.length}</span></span>
        <span className="text-sm font-semibold">{metric.label}</span><span className="text-xs font-normal text-muted-foreground">{metric.caption}</span>
      </Button>)}
    </div>
    <div className="flex flex-wrap items-center gap-2 border-b pb-3"><Users className="size-4 text-primary" /><h3 className="text-sm font-semibold">{current.label}</h3><span className="text-xs text-muted-foreground">{current.rows.length} workers · {name}</span></div>
    {current.rows.length === 0 ? <p className="py-5 text-sm text-muted-foreground">No workers in this category.</p> : <div className="max-h-80 overflow-auto rounded-lg border border-border" tabIndex={0} role="region" aria-label={`${current.label} workers`}>
      <table className="w-full min-w-[580px] text-left text-sm"><thead className="sticky top-0 bg-muted"><tr>{["Worker", "Company", "P-File", "Onboarding stage", "Expiry"].map((heading) => <th key={heading} className="px-4 py-3 font-medium">{heading}</th>)}</tr></thead><tbody>{current.rows.map((e) => <tr key={e.id} className="border-t bg-card"><td className="px-4 py-3"><Link className="font-medium text-primary hover:underline" to="/workforce/$slug" params={{ slug: employeeSlugById(e.id) }}>{e.name}</Link></td><td className="px-4 py-3">{companies.find((c) => c.id === e.companyId)?.code ?? "—"}</td><td className="px-4 py-3">{e.employeeCode || "—"}</td><td className="px-4 py-3">{e.wpStage || "—"}</td><td className="px-4 py-3">{category === "csoc" ? e.safetyCourseExpiry || "See certificates" : e.passExpiry || "—"}</td></tr>)}</tbody></table>
    </div>}
  </section>;
}