import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BellRing,
  ChevronDown,
  Plus,
  Search,
  SidebarIcon,
  UserRound,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Link, useRouterState } from "@tanstack/react-router";

import { buildAlerts } from "@/lib/alerts";
import { AiNoticesTray } from "@/components/assistant-alerts";
import { useAuth } from "@/lib/auth";
import { canAccess } from "@/core/access";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { AppBreadcrumbs } from "@/components/nav/breadcrumbs";
import { GlobalSearchDialog, useGlobalSearchHotkey } from "@/components/search/global-search";



const quickCreateItems = [
  { label: "Employee", to: "/workforce", search: { new: true } },
  { label: "Client", to: "/clients", search: { new: true } },
  { label: "Project", to: "/projects", search: { new: true } },
  { label: "Assignment", to: "/operations", search: { new: true } },
  { label: "Attendance entry", to: "/time-management", search: { new: true } },
] as const;

const SEEN_KEY = "bsm.alerts.seen";

function readSeen(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SEEN_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function AppHeader() {
  const { user, roles, signOut } = useAuth();
  const currentPath = useRouterState({ select: (state) => state.location.pathname });
  const canSearch = roles.includes("admin");
  const visibleCreateItems = quickCreateItems.filter((item) => canAccess(item.to, roles));
  const initials = user?.email?.slice(0, 2).toUpperCase() ?? "BS";
  const alerts = canAccess("/alerts", roles) ? buildAlerts() : [];
  const [searchOpen, setSearchOpen] = useState(false);
  useGlobalSearchHotkey(useCallback(() => { if (canSearch) setSearchOpen(true); }, [canSearch]));

  const [seen, setSeen] = useState<string[]>([]);
  useEffect(() => setSeen(readSeen()), []);

  const unseenCount = useMemo(
    () => alerts.filter((a) => !seen.includes(a.id)).length,
    [alerts, seen],
  );

  const markAllSeen = useCallback(() => {
    const ids = alerts.map((a) => a.id);
    setSeen(ids);
    try {
      window.localStorage.setItem(SEEN_KEY, JSON.stringify(ids));
    } catch {
      /* ignore */
    }
  }, [alerts]);

  return (
    <header className="sticky top-0 z-30 flex h-16 flex-col border-b border-border bg-card">
      <div className="flex min-w-0 flex-1 items-center gap-2 px-3 sm:px-5">
        <SidebarTrigger aria-label="Toggle sidebar" className="min-h-11 min-w-11 shrink-0">
          <SidebarIcon className="h-4 w-4" />
          <span className="sr-only">Toggle sidebar</span>
        </SidebarTrigger>

        <div className="hidden min-w-0 flex-1 items-center gap-4 md:flex">
          <AppBreadcrumbs />
        </div>

        <div className="ml-auto flex min-w-0 shrink-0 items-center justify-end gap-1 sm:gap-2">
          {canSearch && <>
          <Button
            variant="outline"
            type="button"
            onClick={() => setSearchOpen(true)}
            className="relative hidden h-9 w-40 items-center rounded-md border bg-background/60 pl-9 pr-2 text-left text-sm text-muted-foreground transition-colors hover:bg-accent/50 sm:flex xl:w-56"
          >
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2" />
            <span className="flex-1 truncate">Search anything…</span>
            <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium">
              ⌘K
            </kbd>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Search all records"
            className="min-h-11 min-w-11 shrink-0 sm:hidden"
            onClick={() => setSearchOpen(true)}
          >
            <Search className="h-4 w-4" />
            <span className="sr-only">Search</span>
          </Button>
          <GlobalSearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
          </>}

          {visibleCreateItems.length > 0 && <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="hidden gap-1 sm:flex">
                <Plus className="h-4 w-4" />
                <span className="text-xs">Create</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Quick create</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {visibleCreateItems.map((item) => (
                <DropdownMenuItem key={item.label} asChild>
                  <Link to={item.to} search={item.search} onClick={() => {
                    if (currentPath === item.to) window.dispatchEvent(new CustomEvent("bsm:quick-create", { detail: item.to }));
                  }}>
                    {item.label}
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>}

          <AiNoticesTray />
          {canAccess("/alerts", roles) && <Tooltip>
            <TooltipTrigger asChild>
              <Button
                asChild
                variant="ghost"
                size="icon"
                className="relative min-h-11 min-w-11 shrink-0"
              >
                <Link to="/alerts" aria-label={`Alerts Centre${unseenCount > 0 ? `, ${unseenCount} unread alerts` : ""}`} onClick={markAllSeen}>
                  <BellRing className="h-4 w-4" />
                  {unseenCount > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground ring-1 ring-background">
                      {unseenCount > 99 ? "99+" : unseenCount}
                    </span>
                  )}
                  <span className="sr-only">Alerts Centre</span>
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Alerts Centre</TooltipContent>
          </Tooltip>}

          {canAccess("/my-portal", roles) && <Tooltip>
            <TooltipTrigger asChild>
              <Button
                asChild
                variant="ghost"
                size="icon"
                className="min-h-11 min-w-11 shrink-0"
              >
                <Link to="/my-portal">
                  <UserRound className="h-4 w-4" />
                  <span className="sr-only">My Portal</span>
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>My Portal</TooltipContent>
          </Tooltip>}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" aria-label="My account" className="max-w-52 gap-2 pl-1">
                <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center text-xs font-semibold text-primary-foreground">
                  {initials}
                </div>
                <span className="hidden min-w-0 truncate text-xs font-medium lg:inline">{user?.email ?? "Account"}</span>
                <ChevronDown className="hidden h-3.5 w-3.5 sm:inline" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>My account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {canAccess("/my-portal", roles) && <DropdownMenuItem asChild><Link to="/my-portal">My profile</Link></DropdownMenuItem>}
              {canAccess("/settings", roles) && <DropdownMenuItem asChild><Link to="/settings">Settings & security</Link></DropdownMenuItem>}
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

