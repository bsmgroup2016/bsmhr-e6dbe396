import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { AppHeader } from "@/components/app-header";
import { MobileNav } from "@/components/nav/mobile-nav";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <SidebarProvider defaultOpen={true}>
      <AppSidebar />
      <SidebarInset className="min-h-svh bg-background">
        <AppHeader />
        <main className="flex-1 p-5 pb-24 sm:p-8 md:pb-10">{children}</main>
        <MobileNav />
      </SidebarInset>
    </SidebarProvider>
  );
}
