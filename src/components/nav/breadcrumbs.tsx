import * as React from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

interface Crumb {
  label: string;
  href?: string;
}

const routeLabels: Record<string, string> = {
  workforce: "Workforce",
  clients: "Clients",
  projects: "Projects & Sites",
  operations: "Operations",
  "time-management": "Attendance & OT",
  payroll: "Workforce Payroll",
  documents: "Documents",
  approvals: "Approvals",
  reports: "Reports",
  users: "Users & Permissions",
  "audit-logs": "Audit Logs",
  settings: "Settings",
  "time-cards": "ClaimSheet Generator",
  compliance: "MOM Compliance",
  mom: "Levy & Quota (DRC)",
  leave: "Leave Management",
  training: "Training & WSH Safety",
  assets: "PPE Management",
  companies: "Companies",
  quotations: "Quotation Management",
  crm: "Business Pipeline (CRM)",
  contracts: "Rate Agreements",
  billing: "Billing & Invoicing",
  "driver-dispatch": "Dispatch & Live Tracking",
  drivers: "Driver Roster & Licences",
  "driver-duty": "Daily Duty & Trips",
  transport: "Vehicles & Fleet",
  "driver-compliance": "Fuel, Fines & Incidents",
  "staff-management": "Staff Directory",
  "staff-attendance": "Staff Attendance",
  "staff-payroll": "Staff Payroll",
  recruitment: "Foreign Recruitment",
  finance: "Finance & Accounts",
  accommodation: "Accommodation (Dorm)",
  assistant: "Chatbot Training",
  "my-portal": "My Portal",
  alerts: "Alerts Centre",
};

export function AppBreadcrumbs() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const segments = pathname.split("/").filter(Boolean);

  const crumbs: Crumb[] = [{ label: "Dashboard", href: segments.length && pathname !== "/dashboard" ? "/dashboard" : undefined }];

  segments.forEach((segment, index) => {
    if (segment === "dashboard") return;
    const label = routeLabels[segment] || segment.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
    const href = index < segments.length - 1 ? "/" + segments.slice(0, index + 1).join("/") : undefined;
    crumbs.push({ label, href });
  });

  return (
    <Breadcrumb className="min-w-0">
      <BreadcrumbList>
        {crumbs.map((crumb, index) => (
          <React.Fragment key={`${crumb.label}-${index}`}>
            <BreadcrumbItem>
              {crumb.href ? (
                <BreadcrumbLink asChild>
                  <Link to={crumb.href}>{crumb.label}</Link>
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
              )}
            </BreadcrumbItem>
            {index < crumbs.length - 1 && <BreadcrumbSeparator />}
          </React.Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
