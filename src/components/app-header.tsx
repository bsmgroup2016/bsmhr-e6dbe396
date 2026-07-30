import { useCallback, useState } from "react";
import {
  Bell,
  ChevronDown,
  Plus,
  Search,
  SidebarIcon,
} from "lucide-react";
import { Link } from "@tanstack/react-router";

import { cn } from "@/lib/utils";
import { alertCounts, buildAlerts } from "@/lib/alerts";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { AppBreadcrumbs } from "@/components/nav/breadcrumbs";
import { GlobalSearchDialog, useGlobalSearchHotkey } from "@/components/search/global-search";



const quickCreateItems = [
  { label: "Employee", to: "/workforce", search: { new: true } },
  { label: "Client", to: "/clients", search: { new: true } },
  { label: "Project", to: "/projects", search: { new: true } },
  { label: "Site", to: "/projects", search: {} },
  { label: "Assignment", to: "/operations", search: { new: true } },
  { label: "Attendance entry", to: "/time-management", search: { new: true } },
] as const;

export function AppHeader() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { user, signOut } = useAuth();
  const initials = user?.email?.slice(0, 2).toUpperCase() ?? "BS";
  const alerts = buildAlerts();
  const counts = alertCounts(alerts);
  const [searchOpen, setSearchOpen] = useState(false);
  useGlobalSearchHotkey(useCallback(() => setSearchOpen(true), []));

  return (
    <header className="sticky top-0 z-30 flex h-16 flex-col border-b border-border/70 bg-gradient-surface backdrop-blur supports-[backdrop-filter]:bg-card/70">
      <div className="flex flex-1 items-center gap-2 px-5">
        <SidebarTrigger className="h-8 w-8 shrink-0">
          <SidebarIcon className="h-4 w-4" />
          <span className="sr-only">Toggle sidebar</span>
        </SidebarTrigger>

        <div className="hidden md:flex items-center gap-4">
          <AppBreadcrumbs />
        </div>

        <div className="flex flex-1 items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="relative hidden h-8 w-64 items-center rounded-md border bg-background/60 pl-9 pr-2 text-left text-sm text-muted-foreground transition-colors hover:bg-accent/50 sm:flex"
          >
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2" />
            <span className="flex-1 truncate">Search anything…</span>
            <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium">
              ⌘K
            </kbd>
          </button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 sm:hidden"
            onClick={() => setSearchOpen(true)}
          >
            <Search className="h-4 w-4" />
            <span className="sr-only">Search</span>
          </Button>
          <GlobalSearchDialog open={searchOpen} onOpenChange={setSearchOpen} />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="hidden gap-1 sm:flex">
                <Plus className="h-4 w-4" />
                <span className="text-xs">Create</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Quick create</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {quickCreateItems.map((item) => (
                <DropdownMenuItem key={item.label} asChild>
                  <Link to={item.to} search={item.search}>
                    {item.label}
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative h-8 w-8 shrink-0">
                <Bell className="h-4 w-4" />
                {counts.total > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground ring-1 ring-background">
                    {counts.total > 99 ? "99+" : counts.total}
                  </span>
                )}
                <span className="sr-only">Notifications</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel className="flex items-center justify-between">
                <span>Alerts</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {counts.critical} critical
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {alerts.length === 0 ? (
                <div className="px-2 py-6 text-center text-xs text-muted-foreground">
                  Nothing needs attention
                </div>
              ) : (
                alerts.slice(0, 6).map((a) => (
                  <DropdownMenuItem key={a.id} asChild>
                    <Link to={a.link} className="flex flex-col items-start gap-0.5">
                      <span className="flex w-full items-center gap-2">
                        <span
                          className={cn(
                            "h-1.5 w-1.5 shrink-0 rounded-full",
                            a.severity === "critical"
                              ? "bg-destructive"
                              : a.severity === "warning"
                                ? "bg-warning"
                                : "bg-muted-foreground",
                          )}
                        />
                        <span className="truncate text-xs font-medium">{a.title}</span>
                      </span>
                      <span className="truncate pl-3.5 text-[11px] text-muted-foreground">
                        {a.detail}
                      </span>
                    </Link>
                  </DropdownMenuItem>
                ))
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/alerts" className="justify-center text-xs font-medium">
                  View all alerts
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2 pl-1">
                <div className="h-7 w-7 rounded-full bg-gradient-primary flex items-center justify-center text-xs font-semibold text-primary-foreground shadow-elegant">
                  {initials}
                </div>
                <span className="hidden text-xs font-medium sm:inline">{user?.email ?? "Admin"}</span>
                <ChevronDown className="hidden h-3.5 w-3.5 sm:inline" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>My account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Profile</DropdownMenuItem>
              <DropdownMenuItem>Preferences</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive" onClick={() => signOut()}>
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

