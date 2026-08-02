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
  "time-management": "Time Management",
  payroll: "Payroll",
  documents: "Documents",
  approvals: "Approvals",
  reports: "Reports",
  users: "Users & Permissions",
  "audit-logs": "Audit Logs",
  settings: "Settings",
};

export function AppBreadcrumbs() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const segments = pathname.split("/").filter(Boolean);

  const crumbs: Crumb[] = [{ label: "amr amrk kora jayga follow koro", href: "/" }];

  segments.forEach((segment, index) => {
    const label = routeLabels[segment] || segment.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
    const href = index < segments.length - 1 ? "/" + segments.slice(0, index + 1).join("/") : undefined;
    crumbs.push({ label, href });
  });

  return (
    <Breadcrumb>
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
