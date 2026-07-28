import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { Settings } from "lucide-react";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — BSM Workforce & Operations" },
      { name: "description", content: "System settings for BSM Engineering." },
      { property: "og:title", content: "Settings — BSM Workforce & Operations" },
      { property: "og:description", content: "System settings for BSM Engineering." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-7xl">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">Organization, branches, and system configuration.</p>
        <EmptyState
          className="mt-6"
          icon={<Settings className="h-5 w-5" />}
          title="Settings module"
          description="System settings will be implemented in Phase 8."
        />
      </div>
    </AppShell>
  );
}
