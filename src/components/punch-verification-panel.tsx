import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Flag, MapPin, RefreshCw, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { R2Image } from "@/components/r2-image";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getEmployees, getSites } from "@/lib/store";

type Filter = "flagged" | "verified" | "all";

interface EventRow {
  id: string;
  employee_id: string | null;
  kind: string | null;
  date: string | null;
  punched_at: string | null;
  site_id: string | null;
  selfie_key: string | null;
  accuracy_m: number | null;
  distance_m: number | null;
  geo_status: string | null;
  verification: string | null;
  flags: string[] | null;
  source: string | null;
}

const flagLabels: Record<string, string> = {
  selfie_missing: "Selfie missing",
  no_selfie: "No selfie",
  no_gps: "No GPS",
  low_gps_accuracy: "Poor GPS accuracy",
  outside_geofence: "Outside site radius",
  no_site_geo: "Site has no geofence",
};

/**
 * HR review queue for selfie + GPS punches. Shows every punch event with its
 * verification verdict so a flagged punch can be accepted or kept flagged.
 */
export function PunchVerificationPanel() {
  const employees = getEmployees();
  const sites = getSites();
  const [rows, setRows] = useState<EventRow[]>([]);
  const [filter, setFilter] = useState<Filter>("flagged");
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("attendance_events")
      .select(
        "id,employee_id,kind,date,punched_at,site_id,selfie_key,accuracy_m,distance_m,geo_status,verification,flags,source",
      )
      .order("punched_at", { ascending: false })
      .limit(100);
    if (filter !== "all") query = query.eq("verification", filter);
    const { data, error } = await query;
    setLoading(false);
    if (error) {
      toast.error("Unable to load punch events");
      return;
    }
    setRows((data ?? []) as EventRow[]);
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(
    () => ({
      shown: rows.length,
      withSelfie: rows.filter((r) => r.selfie_key).length,
    }),
    [rows],
  );

  const setVerdict = async (row: EventRow, verification: "verified" | "flagged") => {
    setBusyId(row.id);
    const { error } = await supabase
      .from("attendance_events")
      .update({ verification })
      .eq("id", row.id);
    setBusyId(null);
    if (error) {
      toast.error("Unable to update this punch");
      return;
    }
    toast.success(verification === "verified" ? "Punch accepted" : "Punch kept flagged");
    void load();
  };

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <ShieldAlert className="h-4 w-4 text-primary" />
            Punch verification review
          </h2>
          <p className="text-xs text-muted-foreground">
            Selfie and GPS checks on mobile punches — {counts.shown} shown, {counts.withSelfie} with
            a selfie.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={(v) => setFilter(v as Filter)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="flagged">Flagged only</SelectItem>
              <SelectItem value="verified">Verified</SelectItem>
              <SelectItem value="all">All punches</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" disabled={loading} onClick={() => void load()}>
            <RefreshCw className={loading ? "mr-1 h-3.5 w-3.5 animate-spin" : "mr-1 h-3.5 w-3.5"} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Selfie</TableHead>
              <TableHead>Employee</TableHead>
              <TableHead>Punch</TableHead>
              <TableHead>Site</TableHead>
              <TableHead>GPS</TableHead>
              <TableHead>Checks</TableHead>
              <TableHead>Verdict</TableHead>
              <TableHead className="w-44 text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center">
                  <EmptyState
                    className="border-0 bg-transparent"
                    icon={<CheckCircle2 className="h-5 w-5" />}
                    title="Nothing to review"
                    description={
                      filter === "flagged"
                        ? "No flagged punches — all mobile punches passed the selfie and GPS checks."
                        : "No punch events recorded yet."
                    }
                  />
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => {
                const emp = employees.find((e) => e.id === row.employee_id);
                const site = sites.find((s) => s.id === row.site_id);
                const time = row.punched_at
                  ? new Date(row.punched_at).toLocaleString("en-SG", {
                      hour: "2-digit",
                      minute: "2-digit",
                      day: "2-digit",
                      month: "short",
                    })
                  : "—";
                return (
                  <TableRow key={row.id}>
                    <TableCell>
                      <R2Image
                        src={row.selfie_key ?? undefined}
                        alt={`Punch selfie for ${emp?.name ?? "worker"}`}
                        className="h-12 w-12 rounded-md object-cover"
                        fallback={
                          <div className="flex h-12 w-12 items-center justify-center rounded-md border border-dashed text-[10px] text-muted-foreground">
                            None
                          </div>
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{emp?.name ?? "Unknown"}</div>
                      <div className="text-xs text-muted-foreground">{emp?.employeeCode ?? "—"}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{row.kind === "checkOut" ? "Clock out" : "Clock in"}</div>
                      <div className="text-xs text-muted-foreground">
                        {time} · {row.source ?? "mobile"}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{site?.name ?? "—"}</TableCell>
                    <TableCell className="text-xs">
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        {row.geo_status === "inside"
                          ? "Inside site"
                          : row.geo_status === "outside"
                            ? "Outside site"
                            : "Unknown"}
                      </div>
                      <div className="text-muted-foreground">
                        {row.distance_m != null ? `${row.distance_m} m away` : "no distance"}
                        {row.accuracy_m != null ? ` · ±${row.accuracy_m} m` : ""}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(row.flags ?? []).length === 0 ? (
                          <span className="text-xs text-muted-foreground">All good</span>
                        ) : (
                          (row.flags ?? []).map((f) => (
                            <span
                              key={f}
                              className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                            >
                              {flagLabels[f] ?? f}
                            </span>
                          ))
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        dot
                        variant={
                          row.verification === "verified"
                            ? "success"
                            : row.verification === "flagged"
                              ? "destructive"
                              : "warning"
                        }
                        label={row.verification ?? "unverified"}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busyId === row.id || row.verification === "verified"}
                          onClick={() => void setVerdict(row, "verified")}
                        >
                          <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busyId === row.id || row.verification === "flagged"}
                          onClick={() => void setVerdict(row, "flagged")}
                        >
                          <Flag className="mr-1 h-3.5 w-3.5" />
                          Flag
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
