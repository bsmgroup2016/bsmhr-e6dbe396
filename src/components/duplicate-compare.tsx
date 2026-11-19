import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { DuplicateEmployee } from "@/core/employee-duplicates";

/** Form field name -> employees column, label. Read-only comparison; never writes. */
export const COMPARE_FIELDS: [string, string, string][] = [
  ["name", "name", "Name"], ["employeeCode", "employee_code", "P-File number"], ["fin", "fin", "FIN"],
  ["passportNumber", "passport_number", "Passport number"], ["passportExpiry", "passport_expiry", "Passport expiry"],
  ["nationality", "nationality", "Nationality"], ["dateOfBirth", "date_of_birth", "Date of birth"], ["gender", "gender", "Gender"],
  ["passType", "pass_type", "Pass type"], ["passExpiry", "pass_expiry", "Pass expiry"],
  ["jobTitle", "job_title", "Job title"], ["phone", "phone", "Phone"], ["email", "email", "Email"],
  ["joinedOn", "joined_on", "Joined on"], ["dormitory", "dormitory", "Dormitory"],
];
const norm = (v: unknown) => String(v ?? "").trim().toUpperCase().replace(/\s+/g, " ");

export function DuplicateCompareDialog({ match, formValues, onClose }: { match: DuplicateEmployee | null; formValues: Record<string, string>; onClose: () => void }) {
  const [row, setRow] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");
  const id = match?.employee.id;
  useEffect(() => {
    if (!id) return;
    setRow(null); setError("");
    supabase.from("employees").select(["status", ...COMPARE_FIELDS.map(f => f[1])].join(",")).eq("id", id).maybeSingle()
      .then(({ data, error: e }) => { if (e || !data) setError("Could not load the existing worker record."); else setRow(data as unknown as Record<string, unknown>); });
  }, [id]);
  return (
    <Dialog open={!!match} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Compare with existing worker</DialogTitle>
          <DialogDescription>{match?.employee.name} · {match?.employee.employeeCode}{row?.status ? ` · ${String(row.status)}` : ""}. Highlighted rows differ.</DialogDescription>
        </DialogHeader>
        {error ? <p className="text-sm text-destructive">{error}</p> : !row ? <p className="text-sm text-muted-foreground">Loading…</p> :
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left"><tr><th className="p-2">Field</th><th className="p-2">This form</th><th className="p-2">Existing record</th></tr></thead>
              <tbody>{COMPARE_FIELDS.map(([key, col, label]) => {
                const a = formValues[key] ?? ""; const b = row[col] == null ? "" : String(row[col]);
                const same = norm(a) === norm(b); const matched = match?.fields.includes(key as never);
                return <tr key={key} className={`border-t ${matched ? "bg-destructive/10" : !same && (a || b) ? "bg-accent/40" : ""}`}>
                  <td className="p-2 font-medium">{label}{matched && <span className="ml-1 text-xs text-destructive">(match)</span>}</td>
                  <td className="p-2 break-words">{a || "—"}</td><td className="p-2 break-words">{b || "—"}</td></tr>;
              })}</tbody>
            </table>
          </div>}
      </DialogContent>
    </Dialog>
  );
}
