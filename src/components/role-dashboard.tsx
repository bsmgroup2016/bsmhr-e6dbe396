import { Link, useRouter } from "@tanstack/react-router";
import { LogOut, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { canAccess, hasAssignedRole } from "@/core/access";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/app-shell";

const destinations = [
  { to: "/my-portal", label: "My attendance & payslips" },
  { to: "/workforce", label: "Workforce" },
  { to: "/projects", label: "Projects & sites" },
  { to: "/operations", label: "Manpower deployment" },
  { to: "/time-management", label: "Attendance & OT" },
  { to: "/billing", label: "Billing & invoicing" },
  { to: "/finance", label: "Finance & accounts" },
  { to: "/payroll", label: "Workforce payroll" },
  { to: "/staff-payroll", label: "Staff payroll" },
  { to: "/audit-logs", label: "Audit logs" },
] as const;

export function WelcomeDashboard() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const name = typeof user?.user_metadata?.full_name === "string" ? user.user_metadata.full_name : "";
  return (
    <div className="min-h-svh bg-background">
      <header className="flex items-center justify-between gap-4 border-b px-6 py-4">
        <span className="font-semibold text-foreground">BSM Engineering</span>
        <Button variant="ghost" onClick={async () => { await signOut(); await router.navigate({ to: "/auth", replace: true }); }}>
          <LogOut className="mr-2 h-4 w-4" />Sign out
        </Button>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-16">
        <ShieldCheck className="mb-5 h-10 w-10 text-primary" />
        <h1 className="text-3xl font-semibold text-foreground">Welcome{name ? `, ${name}` : ""}</h1>
        <p className="mt-3 text-muted-foreground">Your account is ready. An administrator will assign your role before you can access company features.</p>
      </main>
    </div>
  );
}

export function RoleDashboard() {
  const { roles } = useAuth();
  if (!hasAssignedRole(roles)) return <WelcomeDashboard />;
  return (
    <AppShell>
      <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
      <nav className="mt-6 grid gap-3 sm:grid-cols-2">
        {destinations.filter((item) => canAccess(item.to, roles)).map((item) => (
          <Button key={item.to} asChild variant="outline" className="h-14 justify-start">
            <Link to={item.to}>{item.label}</Link>
          </Button>
        ))}
      </nav>
    </AppShell>
  );
}