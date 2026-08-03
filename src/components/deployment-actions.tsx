import { useState } from "react";
import { ArrowLeftRight, LogOut } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { addAssignment, updateAssignment } from "@/lib/store";
import type { Assignment, Employee, Project, Site } from "@/lib/types";

const today = () => new Date().toISOString().slice(0, 10);

interface Props {
  assignment: Assignment;
  employee: Employee;
  projects: Project[];
  sites: Site[];
  mode: "transfer" | "offhire";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}

/** Transfer a deployed worker to another project/site, or off-hire them back to the pool. */
export function DeploymentActionDialog({
  assignment, employee, projects, sites, mode, open, onOpenChange, onDone,
}: Props) {
  const [projectId, setProjectId] = useState(assignment.projectId);
  const [siteId, setSiteId] = useState(assignment.siteId);
  const [effectiveDate, setEffectiveDate] = useState(today());
  const [reason, setReason] = useState("");

  const projectSites = sites.filter((s) => s.projectId === projectId);

  function submit() {
    if (mode === "transfer") {
      if (!projectId) return toast.error("Select a destination project");
      if (projectId === assignment.projectId && siteId === assignment.siteId) {
        return toast.error("Pick a different project or site to transfer");
      }
      updateAssignment(assignment.id, {
        status: "Transferred",
        endDate: effectiveDate,
        remarks: [assignment.remarks, `Transferred out: ${reason || "no reason given"}`].filter(Boolean).join(" | "),
      });
      addAssignment({
        employeeId: employee.id,
        projectId,
        siteId: siteId || projectSites[0]?.id || "",
        startDate: effectiveDate,
        status: "Active",
        remarks: `Transferred in from previous deployment${reason ? ` — ${reason}` : ""}`,
      });
      toast.success(`${employee.name} transferred`);
    } else {
      updateAssignment(assignment.id, {
        status: "Ended",
        endDate: effectiveDate,
        remarks: [assignment.remarks, `Off-hired: ${reason || "no reason given"}`].filter(Boolean).join(" | "),
      });
      toast.success(`${employee.name} off-hired — back in available pool`);
    }
    onOpenChange(false);
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === "transfer" ? <ArrowLeftRight className="h-4 w-4" /> : <LogOut className="h-4 w-4" />}
            {mode === "transfer" ? "Transfer worker" : "Off-hire worker"}
          </DialogTitle>
          <DialogDescription>
            {employee.name} · P-File No: {employee.employeeCode}
            {mode === "transfer"
              ? " — close the current deployment and open a new one."
              : " — end the deployment and release to the available pool."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {mode === "transfer" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Destination project</Label>
                <Select
                  value={projectId}
                  onValueChange={(v) => {
                    setProjectId(v);
                    setSiteId(sites.find((s) => s.projectId === v)?.id ?? "");
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Project" /></SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Destination site</Label>
                <Select value={siteId} onValueChange={setSiteId}>
                  <SelectTrigger><SelectValue placeholder="Site" /></SelectTrigger>
                  <SelectContent>
                    {projectSites.map((s) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Effective date</Label>
            <Input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Reason / remarks</Label>
            <Textarea
              rows={3}
              placeholder={mode === "transfer" ? "Client request, manpower rebalance..." : "Project completed, client released worker..."}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit}>{mode === "transfer" ? "Confirm transfer" : "Confirm off-hire"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
