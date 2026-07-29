import { Link, useRouterState } from "@tanstack/react-router";
import {
  BadgeDollarSign,
  BedDouble,
  Briefcase,
  Building2,
  Boxes,
  CalendarClock,
  ClipboardList,
  FileText,
  FolderKanban,
  Gauge,
  HardHat,
  Handshake,
  Layers,
  Loader2,
  LogOut,
  Receipt,
  Settings,
  ShieldCheck,
  Truck,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { canAccess } from "@/lib/permissions";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

type NavItem = { title: string; url: string; icon: typeof Gauge; soon?: boolean };

const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: "Overview",
    items: [
      { title: "Dashboard", url: "/", icon: Gauge },
      { title: "Companies", url: "/companies", icon: Building2 },
    ],
  },
  {
    label: "Workforce",
    items: [
      { title: "Employees", url: "/workforce", icon: Users },
      { title: "Documents", url: "/documents", icon: FileText },
      { title: "Compliance", url: "/compliance", icon: ShieldCheck },
      { title: "Time Management", url: "/time-management", icon: CalendarClock },
      { title: "Leave", url: "/leave", icon: CalendarClock },
      { title: "Payroll", url: "/payroll", icon: Briefcase },
    ],
  },
  {
    label: "Operations",
    items: [
      { title: "Clients", url: "/clients", icon: Handshake },
      { title: "Projects & Sites", url: "/projects", icon: FolderKanban },
      { title: "Deployment", url: "/operations", icon: Layers },
    ],
  },
  {
    label: "Business",
    items: [
      { title: "Recruitment", url: "/recruitment", icon: UserPlus, soon: true },
      { title: "Client CRM", url: "/crm", icon: BadgeDollarSign, soon: true },
      { title: "Billing & Invoicing", url: "/billing", icon: Receipt, soon: true },
      { title: "Finance", url: "/finance", icon: Wallet, soon: true },
    ],
  },
  {
    label: "Resources",
    items: [
      { title: "Accommodation", url: "/accommodation", icon: BedDouble },
      { title: "Transport & Drivers", url: "/transport", icon: Truck },
      { title: "Assets & PPE", url: "/assets", icon: Boxes },
    ],
  },
  {
    label: "Administration",
    items: [
      { title: "Approvals", url: "/approvals", icon: ClipboardList },
      { title: "Reports", url: "/reports", icon: ClipboardList },
      { title: "Users & Permissions", url: "/users", icon: ShieldCheck },
      { title: "Audit Logs", url: "/audit-logs", icon: HardHat },
      { title: "Settings", url: "/settings", icon: Settings },
    ],
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const currentPath = useRouterState({ select: (router) => router.location.pathname });
  const { user, roles, isLoading, signOut } = useAuth();

  const visibleGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => canAccess(item.url, roles)),
    }))
    .filter((group) => group.items.length > 0);

  const isActive = (path: string) => {
    if (path === "/") return currentPath === "/";
    return currentPath === path || currentPath.startsWith(`${path}/`);
  };

  const initials = user?.email?.slice(0, 2).toUpperCase() ?? "BS";
  const roleLabel = roles.length ? roles.join(", ").replace(/_/g, " ") : "No role assigned";

  return (
    <Sidebar
      collapsible="icon"
      variant="sidebar"
      className="[&>[data-sidebar=sidebar]]:bg-[image:var(--gradient-sidebar)]"
    >
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex h-14 items-center gap-3 px-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-primary text-primary-foreground font-bold text-sm shadow-glow">
            BSM
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-sidebar-foreground">BSM Engineering</p>
              <p className="truncate text-xs text-sidebar-foreground/70">Workforce & Operations</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {visibleGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="text-sidebar-foreground/50">{group.label}</SidebarGroupLabel>
            <SidebarMenu>
              {group.items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <Link to={item.url} className="flex items-center gap-3">
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{item.title}</span>
                      {item.soon && !collapsed && (
                        <span className="ml-auto rounded-full bg-sidebar-foreground/10 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-sidebar-foreground/60">
                          Soon
                        </span>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              tooltip="Sign out"
              className="text-sidebar-foreground/80"
              onClick={() => signOut()}
            >
              <button className="flex w-full items-center gap-3">
                {isLoading ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <LogOut className="h-4 w-4 shrink-0" />}
                <span className="truncate">Sign out</span>
              </button>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <Separator className="bg-sidebar-border" />
        <div className={cn("px-4 py-3", collapsed && "px-2")}>
          {!collapsed ? (
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 shrink-0 rounded-full bg-sidebar-primary/20 flex items-center justify-center text-xs font-semibold text-sidebar-primary-foreground">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-sidebar-foreground">{user?.email ?? "Loading..."}</p>
                <p className="truncate text-xs capitalize text-sidebar-foreground/70">{roleLabel}</p>
              </div>
            </div>
          ) : (
            <div className="flex justify-center">
              <div className="h-8 w-8 rounded-full bg-sidebar-primary/20 flex items-center justify-center text-xs font-semibold text-sidebar-primary-foreground">
                {initials}
              </div>
            </div>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

