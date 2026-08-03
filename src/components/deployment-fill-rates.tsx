import { AlertTriangle, Building2, TrendingUp } from "lucide-react";

import { StatusBadge } from "@/components/ui/status-badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { Assignment, Project, Site } from "@/lib/types";

interface Props {
  projects: Project[];
  sites: Site[];
  assignments: Assignment[];
  onSelectProject?: (projectId: string) => void;
}

const isLive = (a: Assignment) => a.status === "Active" || a.status === "Approved";

export function DeploymentFillRates({ projects, sites, assignments, onSelectProject }: Props) {
  const rows = projects
    .map((p) => {
      const projectSites = sites.filter((s) => s.projectId === p.id);
      const deployed = assignments.filter((a) => a.projectId === p.id && isLive(a)).length;
      const pending = assignments.filter((a) => a.projectId === p.id && a.status === "Pending").length;
      const required = p.requiredWorkers || projectSites.reduce((s, x) => s + (x.requiredWorkers || 0), 0);
      const gap = Math.max(0, required - deployed);
      const fill = required > 0 ? Math.round((deployed / required) * 100) : 0;
      return { project: p, sites: projectSites, deployed, pending, required, gap, fill };
    })
    .sort((a, b) => b.gap - a.gap);

  const totalRequired = rows.reduce((s, r) => s + r.required, 0);
  const totalDeployed = rows.reduce((s, r) => s + r.deployed, 0);
  const totalGap = rows.reduce((s, r) => s + r.gap, 0);
  const overallFill = totalRequired > 0 ? Math.round((totalDeployed / totalRequired) * 100) : 0;

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-medium text-muted-foreground">Manpower demand vs deployment</h2>
          <p className="text-lg font-semibold">
            {totalDeployed} / {totalRequired} positions filled
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1 text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5" /> Fill rate {overallFill}%
          </span>
          <span className={cn("flex items-center gap-1", totalGap > 0 ? "text-warning" : "text-muted-foreground")}>
            <AlertTriangle className="h-3.5 w-3.5" /> Shortfall {totalGap}
          </span>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No projects found for this company.</p>
      ) : (
        <ul className="mt-4 grid gap-3 lg:grid-cols-2">
          {rows.map((r) => (
            <li key={r.project.id}>
              <button
                type="button"
                onClick={() => onSelectProject?.(r.project.id)}
                className="w-full rounded-lg border p-3 text-left transition-colors hover:border-primary/60"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 truncate font-medium">
                      <Building2 className="h-4 w-4 text-primary" />
                      <span className="truncate">{r.project.name}</span>
                    </div>
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">
                      {r.project.location || "—"} · {r.sites.length} site{r.sites.length === 1 ? "" : "s"}
                    </div>
                  </div>
                  <StatusBadge
                    variant={r.gap === 0 ? "success" : r.fill >= 70 ? "warning" : "destructive"}
                    label={r.gap === 0 ? "Fully manned" : `Short ${r.gap}`}
                    dot
                  />
                </div>
                <div className="mt-2.5 space-y-1.5">
                  <Progress value={Math.min(100, r.fill)} className="h-2" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>
                      Deployed {r.deployed} · Required {r.required}
                    </span>
                    <span>{r.pending > 0 ? `${r.pending} pending approval` : `${r.fill}%`}</span>
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
