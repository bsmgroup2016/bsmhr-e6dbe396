import {
  Bell,
  ChevronDown,
  Plus,
  Search,
  SidebarIcon,
} from "lucide-react";
import { Link } from "@tanstack/react-router";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
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

const quickCreateItems = [
  { label: "Employee", href: "#" },
  { label: "Client", href: "#" },
  { label: "Project", href: "#" },
  { label: "Site", href: "#" },
  { label: "Assignment", href: "#" },
  { label: "Attendance entry", href: "#" },
];

const branches = [
  { id: "hq", label: "Headquarters" },
  { id: "east", label: "East Branch" },
  { id: "west", label: "West Branch" },
];

export function AppHeader() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <header className="sticky top-0 z-30 flex h-14 flex-col border-b bg-card">
      <div className="flex flex-1 items-center gap-2 px-4">
        <SidebarTrigger className="h-8 w-8 shrink-0">
          <SidebarIcon className="h-4 w-4" />
          <span className="sr-only">Toggle sidebar</span>
        </SidebarTrigger>

        <div className="hidden md:flex items-center gap-4">
          <AppBreadcrumbs />
        </div>

        <div className="flex flex-1 items-center justify-end gap-2">
          <div className="relative hidden w-64 sm:block">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search employees, sites, clients..."
              className="h-8 pl-9 text-sm"
            />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="hidden gap-1 sm:flex">
                <span className="text-xs">Headquarters</span>
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Select branch</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {branches.map((branch) => (
                <DropdownMenuItem key={branch.id}>
                  {branch.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

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
                  <Link to={item.href}>{item.label}</Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="ghost" size="icon" className="relative h-8 w-8 shrink-0">
            <Bell className="h-4 w-4" />
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive ring-1 ring-background" />
            <span className="sr-only">Notifications</span>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2 pl-1">
                <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                  AD
                </div>
                <span className="hidden text-xs font-medium sm:inline">Admin</span>
                <ChevronDown className="hidden h-3.5 w-3.5 sm:inline" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>My account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Profile</DropdownMenuItem>
              <DropdownMenuItem>Preferences</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive">Sign out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
