import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { CalendarClock } from "lucide-react";

export const Route = createFileRoute("/time-management")({
  head: () => ({
    meta: [
      { title: "Time Management — BSM Workforce & Operations" },
      { name: "description", content: "Attendance and timesheets for BSM Engineering workers." },
      { property: "og:title", content: "Time Management — BSM Workforce & Operations" },
      { property: "og:description", content: "Attendance and timesheets for BSM Engineering workers." },
    ],
  }),
  component: TimeManagementPage,
});

function TimeManagementPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-7xl">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Time Management</h1>
        <p className="text-sm text-muted-foreground">Attendance, timesheets, and hours.</p>
        <EmptyState
          className="mt-6"
          icon={<CalendarClock className="h-5 w-5" />}
          title="Attendance module"
          description="Attendance and timesheet management will be implemented in Phase 5."
        />
      </div>
    </AppShell>
  );
}
