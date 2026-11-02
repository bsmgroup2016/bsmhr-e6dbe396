import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Users, CalendarClock, Bell, UserCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { canAccess } from "@/lib/permissions";

const items = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/workforce", label: "Workforce", icon: Users },
  { to: "/time-management", label: "Time", icon: CalendarClock },
  { to: "/alerts", label: "Alerts", icon: Bell },
  { to: "/my-portal", label: "Portal", icon: UserCircle },
] as const;

export function MobileNav() {
  const { roles } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const visible = items.filter((i) => canAccess(i.to, roles));
  if (!visible.length) return null;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 backdrop-blur md:hidden">
      <ul className="flex items-stretch justify-around pb-[env(safe-area-inset-bottom)]">
        {visible.map((item) => {
          const active = pathname.startsWith(item.to);
          const Icon = item.icon;
          return (
            <li key={item.to} className="flex-1">
              <Link
                to={item.to}
                className={cn(
                  "flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
