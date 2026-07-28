import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { FileText } from "lucide-react";

export const Route = createFileRoute("/documents")({
  head: () => ({
    meta: [
      { title: "Documents — BSM Workforce & Operations" },
      { name: "description", content: "Employee documents and file management for BSM Engineering." },
      { property: "og:title", content: "Documents — BSM Workforce & Operations" },
      { property: "og:description", content: "Employee documents and file management for BSM Engineering." },
    ],
  }),
  component: DocumentsPage,
});

function DocumentsPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-7xl">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Documents</h1>
        <p className="text-sm text-muted-foreground">Passport, work permit, P-File, and other documents.</p>
        <EmptyState
          className="mt-6"
          icon={<FileText className="h-5 w-5" />}
          title="Document module"
          description="Document management will be implemented in Phase 3."
        />
      </div>
    </AppShell>
  );
}
