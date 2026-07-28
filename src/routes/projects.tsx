import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { FolderKanban } from "lucide-react";

export const Route = createFileRoute("/projects")({
  head: () => ({
    meta: [
      { title: "Projects & Sites — BSM Workforce & Operations" },
      { name: "description", content: "Manage BSM Engineering projects and construction sites." },
      { property: "og:title", content: "Projects & Sites — BSM Workforce & Operations" },
      { property: "og:description", content: "Manage BSM Engineering projects and construction sites." },
    ],
  }),
  component: ProjectsPage,
});

function ProjectsPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-7xl">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Projects & Sites</h1>
        <p className="text-sm text-muted-foreground">Project, site, and manpower requirements.</p>
        <EmptyState
          className="mt-6"
          icon={<FolderKanban className="h-5 w-5" />}
          title="No projects yet"
          description="Project and site management will be implemented in Phase 4."
        />
      </div>
    </AppShell>
  );
}
