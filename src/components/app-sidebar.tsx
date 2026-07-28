import { Link, useRouterState } from "@tanstack/react-router";
import {
  Briefcase,
  Building2,
  CalendarClock,
  ClipboardList,
  FileText,
  FolderKanban,
  Gauge,
  HardHat,
  Layers,
  LogOut,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";
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

const mainNav = [
  { title: "Dashboard", url: "/", icon: Gauge },
  { title: "Companies", url: "/companies", icon: Building2 },
  { title: "Workforce", url: "/workforce", icon: Users },
  { title: "Clients", url: "/clients", icon: Building2 },
  { title: "Projects & Sites", url: "/projects", icon: FolderKanban },
  { title: "Operations", url: "/operations", icon: Layers },
  { title: "Time Management", url: "/time-management", icon: CalendarClock },
];

const adminNav = [
  { title: "Payroll", url: "/payroll", icon: Briefcase },
  { title: "Documents", url: "/documents", icon: FileText },
  { title: "Approvals", url: "/approvals", icon: ClipboardList },
  { title: "Reports", url: "/reports", icon: ClipboardList },
  { title: "Users & Permissions", url: "/users", icon: ShieldCheck },
  { title: "Audit Logs", url: "/audit-logs", icon: HardHat },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const currentPath = useRouterState({ select: (router) => router.location.pathname });

  const isActive = (path: string) => {
    if (path === "/") return currentPath === "/";
    return currentPath === path || currentPath.startsWith(`${path}/`);
  };

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
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50">Operations</SidebarGroupLabel>
          <SidebarMenu>
            {mainNav.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                  <Link to={item.url} className="flex items-center gap-3">
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50">Administration</SidebarGroupLabel>
          <SidebarMenu>
            {adminNav.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                  <Link to={item.url} className="flex items-center gap-3">
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Sign out" className="text-sidebar-foreground/80">
              <button className="flex w-full items-center gap-3">
                <LogOut className="h-4 w-4 shrink-0" />
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
                AD
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-sidebar-foreground">Admin User</p>
                <p className="truncate text-xs text-sidebar-foreground/70">Company Admin</p>
              </div>
            </div>
          ) : (
            <div className="flex justify-center">
              <div className="h-8 w-8 rounded-full bg-sidebar-primary/20 flex items-center justify-center text-xs font-semibold text-sidebar-primary-foreground">
                AD
              </div>
            </div>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
