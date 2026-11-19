import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Building2, Clock, ShieldAlert, BadgeCheck, Wallet } from "lucide-react";
import { R2Image } from "@/components/r2-image";
import { companyOverview, orderedCompanies } from "@/core/company-overview";
import { getCompanies, getEmployees, getCertifications, getPayroll } from "@/lib/store";

export function CompanyOverviewCards() {
  const companies = orderedCompanies(getCompanies());
  const entities = [{ id: "group", name: "BSM Group", code: "BSM", logoUrl: undefined as string | undefined }, ...companies];
  return (
    <section aria-label="Company overview" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {entities.map((company) => {
        const group = company.id === "group";
        const data = companyOverview(getEmployees(), getCertifications(), getPayroll(), group ? undefined : company.id);
        return (
          <Link key={company.id} to="/companies/$id" params={{ id: company.id }} aria-label={`Open ${company.name} dashboard`}
            className={`group relative min-w-0 overflow-hidden rounded-lg border p-4 shadow-card transition-shadow hover:shadow-elegant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${group ? "border-primary bg-gradient-primary text-primary-foreground" : "border-border bg-card text-card-foreground"}`}>
            <div className="flex items-start gap-3">
              <div className={`flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg ${group ? "bg-primary-foreground/15" : "bg-primary/10 text-primary"}`}>
                {group ? <Building2 className="size-6" /> : <R2Image src={company.logoUrl} alt={`${company.name} logo`} className="size-full object-contain" fallback={<span className="text-xs font-bold">{company.code}</span>} />}
              </div>
              <div className="min-w-0 flex-1"><h2 className="break-words text-base font-bold">{company.name}</h2><p className={`mt-1 text-xs ${group ? "text-primary-foreground/75" : "text-muted-foreground"}`}>{group ? `${companies.length} companies` : `${data.workers.length} workers`} · {group ? `${data.workers.length} workers` : "Company overview"}</p></div>
              <ArrowUpRight className="size-4 shrink-0 opacity-60 transition-transform group-hover:translate-x-0.5" />
            </div>
            <dl className={`mt-5 space-y-3 border-t pt-4 text-xs ${group ? "border-primary-foreground/20" : "border-border"}`}>
              {[
                { label: "Waiting for issuance", value: data.waiting.length, icon: Clock, tone: "text-warning-text" },
                { label: "Work Permit expiring", value: data.permits.length, icon: ShieldAlert, tone: "text-destructive" },
                { label: "CSOC expiring", value: data.csoc.length, icon: BadgeCheck, tone: "text-info" },
              ].map((metric) => <div key={metric.label} className="flex items-center gap-2"><metric.icon className={`size-4 shrink-0 ${group ? "opacity-75" : metric.tone}`} /><dt className="flex-1">{metric.label}</dt><dd className="text-base font-bold tabular-nums">{metric.value}</dd></div>)}
              <div className={`flex items-center gap-2 border-t pt-3 ${group ? "border-primary-foreground/20" : "border-border"}`}><Wallet className="size-4 shrink-0 opacity-75" /><dt className="flex-1">Annual wages</dt><dd className="break-all text-base font-bold tabular-nums">${Math.round(data.annualWages).toLocaleString("en-SG")}</dd></div>
            </dl>
            <p className={`mt-3 text-[11px] ${group ? "text-primary-foreground/65" : "text-muted-foreground"}`}>Expiries: next 60 days · Wages: {data.year} YTD</p>
          </Link>
        );
      })}
    </section>
  );
}