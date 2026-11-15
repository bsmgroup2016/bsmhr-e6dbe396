import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { AppHeader } from "@/components/app-header";
import { MobileNav } from "@/components/nav/mobile-nav";
import { OfflineBanner } from "@/components/offline-banner";
import { InstallAppBanner } from "@/components/install-app-banner";
import { LiveChatWidget } from "@/components/live-chat-widget";
import { AssistantAlerts } from "@/components/assistant-alerts";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <SidebarProvider defaultOpen={true}>
      <AppSidebar />
      <SidebarInset className="min-h-svh min-w-0 bg-background">
        <AppHeader />
        <InstallAppBanner />
        <OfflineBanner />
        <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 p-4 pb-24 outline-none sm:p-8 md:pb-10">{children}</main>
        <MobileNav />
        <LiveChatWidget />
        <AssistantAlerts />
      </SidebarInset>
    </SidebarProvider>
  );
}
