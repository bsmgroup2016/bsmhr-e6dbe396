import { useRouterState } from "@tanstack/react-router";
import { BriefcaseBusiness, Building2, ChartNoAxesCombined, Settings2, Truck, Users, Boxes } from "lucide-react";

const groups = [
  { label: "Overview", icon: ChartNoAxesCombined, paths: ["dashboard", "companies", "reports", "alerts"] },
  { label: "Workforce", icon: Users, paths: ["workforce", "available-workers", "deployed-workers", "deployment-history", "time-management", "time-cards", "payroll", "leave", "compliance", "onboarding", "mom", "training", "documents", "qr-punch"] },
  { label: "Clients & Deployment", icon: Building2, paths: ["quotations", "clients", "projects", "operations", "contracts", "billing", "crm"] },
  { label: "Drivers & Transport", icon: Truck, paths: ["drivers", "driver-duty", "driver-dispatch", "transport", "driver-compliance"] },
  { label: "Business & HR", icon: BriefcaseBusiness, paths: ["staff-management", "staff-attendance", "staff-payroll", "recruitment", "finance", "my-portal"] },
  { label: "Inventory & Accommodation", icon: Boxes, paths: ["inventory", "assets", "accommodation"] },
  { label: "Administration", icon: Settings2, paths: ["settings", "users", "audit-logs", "approvals", "assistant"] },
];

export function SectionContext() {
  const path = useRouterState({ select: (state) => state.location.pathname.split("/").filter(Boolean)[0] ?? "dashboard" });
  // Attendance already owns its category heading and view controls.
  if (path === "time-management") return null;
  const group = groups.find((entry) => entry.paths.includes(path));
  if (!group) return null;
  const Icon = group.icon;
  return <div className="section-context mb-3 flex items-center gap-2 text-xs font-semibold text-primary"><Icon className="size-4" aria-hidden="true" /><span>{group.label}</span></div>;
}