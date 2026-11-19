import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Settings,
  Building,
  Bell,
  Shield,
  Database,
  Download,
  Upload,
  Trash2,
  Save,
  HardDrive,
  Bot,
  Plus,
} from "lucide-react";
import { SmtpSettings } from "@/components/settings/smtp-settings";
import { StorageSettings } from "@/components/settings/storage-settings";
import { MediaBrowser } from "@/components/settings/media-browser";
import { ApiIntegrationSettings } from "@/components/settings/ai-settings";
import { Badge } from "@/components/ui/badge";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { getBranches, getCurrentBranch, setCurrentBranch, getCompanies, getCurrentCompany, exportState, importState, resetState, getAllBranchPrefixes, addBranchPrefix, updateBranchPrefix, deleteBranchPrefix } from "@/lib/store";
import { checkR2Status } from "@/lib/r2";
import { SystemHealth } from "@/components/settings/system-health";
import { AutomationCentre } from "@/components/settings/automation-centre";
import { CompanyLogos } from "@/components/settings/company-logos";
import { PaymentDetails } from "@/components/settings/payment-details";
import { ChangeLoginEmail } from "@/components/settings/change-login-email";
import { ChangePassword } from "@/components/settings/change-password";
import { ArchiveSettings } from "@/components/settings/archive-settings";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — BSM Workforce & Operations" },
      { name: "description", content: "System settings and configuration." },
      { property: "og:title", content: "Settings — BSM Workforce & Operations" },
      { property: "og:description", content: "System settings and configuration." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

export default function SettingsPage() {
  const { isAdmin } = useAuth();
  const branches = getBranches();
  const company = getCompanies().find((item) => item.id === getCurrentCompany());
  const [currentBranch, setBranch] = useState(getCurrentBranch());
  const [exportData, setExportData] = useState("");
  const [importData, setImportData] = useState("");
  const [saved, setSaved] = useState(false);
  const [r2Test, setR2Test] = useState<string | null>(null);
  const [reloading, setReloading] = useState(false);
  const [importError, setImportError] = useState("");

  async function handleTestR2() {
    setR2Test("Checking...");
    try {
      const status = await checkR2Status();
      if (!status.configured) setR2Test(status.message || "R2 keys are missing");
      else setR2Test(status.reachable ? "R2 bucket connected ✓" : `R2 responded ${status.status}`);
    } catch {
      setR2Test("Could not reach the storage service");
    }
  }

  function handleSave() {
    setCurrentBranch(currentBranch);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleExport() {
    setExportData(exportState());
  }

  function handleImport() {
    setImportError("");
    try {
      importState(importData);
      setImportData("");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setImportError("Invalid JSON. Check the pasted data and try again; no preview was loaded.");
    }
  }

  async function handleReset() {
    setReloading(true);
    try { await resetState(); window.location.reload(); }
    catch { toast.error("Records could not be reloaded. Please try again."); setReloading(false); }
  }

  return (
    <AppShell>
      <div className="w-full space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground">Configure system preferences and manage data.</p>
        </div>

        <Tabs defaultValue="general" className="w-full">
          <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 p-1 [&>button]:flex-none [&>button]:px-3">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="api">API Integration</TabsTrigger>
            <TabsTrigger value="smtp">SMTP</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="storage">Storage</TabsTrigger>
            {isAdmin && <TabsTrigger value="media">Media</TabsTrigger>}
            {isAdmin && <TabsTrigger value="archive">Archive &amp; Clean</TabsTrigger>}
            <TabsTrigger value="data">Data</TabsTrigger>
            <TabsTrigger value="automation">Automation</TabsTrigger>
            <TabsTrigger value="health">Health</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="mt-4 space-y-4">
            <div className="rounded-xl border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Building className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-lg font-semibold">Branch</h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="branch">Current branch</Label>
                  <Select value={currentBranch} onValueChange={setBranch}>
                    <SelectTrigger id="branch">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {branches.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name} ({b.location})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="mt-4">
                <Button onClick={handleSave}>
                  <Save className="mr-2 h-4 w-4" />
                  {saved ? "Saved!" : "Save changes"}
                </Button>
              </div>
            </div>

            <div className="rounded-xl border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Settings className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-lg font-semibold">Company</h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="companyName">Company name</Label>
                  <Input id="companyName" value={company?.legalName || company?.name || ""} placeholder="Not configured" readOnly aria-readonly="true" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="uen">UEN</Label>
                  <Input id="uen" value={company?.uen || ""} placeholder="Not configured" readOnly aria-readonly="true" />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="address">Address</Label>
                  <Input id="address" value={company?.address || ""} placeholder="Not configured" readOnly aria-readonly="true" />
                </div>
              </div>
              <Button variant="link" asChild className="mt-3 px-0"><Link to="/companies">Manage company details</Link></Button>
            </div>

            <CompanyLogos />

            <BranchPrefixManager />
          </TabsContent>

          <TabsContent value="notifications" className="mt-4 space-y-4">
            <div className="rounded-xl border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Bell className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-lg font-semibold">Alert preferences</h2>
                <Badge variant="secondary">Unavailable</Badge>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Pass expiry alerts</p>
                    <p className="text-sm text-muted-foreground">Notify before work passes expire.</p>
                  </div>
                  <Switch disabled aria-label="Pass expiry alerts — unavailable" />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Approval notifications</p>
                    <p className="text-sm text-muted-foreground">Email when a request needs approval.</p>
                  </div>
                  <Switch disabled aria-label="Approval notifications — unavailable" />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Payroll reminders</p>
                    <p className="text-sm text-muted-foreground">Remind before payroll deadline.</p>
                  </div>
                  <Switch disabled aria-label="Payroll reminders — unavailable" />
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="security" className="mt-4 space-y-4">
            <ChangePassword />
            <ChangeLoginEmail />
            <div className="rounded-xl border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-lg font-semibold">Access preferences</h2>
                <Badge variant="secondary">Unavailable</Badge>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Require approval for assignments</p>
                    <p className="text-sm text-muted-foreground">All assignments go through approval workflow.</p>
                  </div>
                  <Switch disabled aria-label="Assignment approval preference — unavailable" />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Audit logging</p>
                    <p className="text-sm text-muted-foreground">Record all data changes.</p>
                  </div>
                  <Switch disabled aria-label="Audit logging preference — unavailable" />
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="api" className="mt-4 space-y-4">
            <ApiIntegrationSettings />
          </TabsContent>




          <TabsContent value="smtp" className="mt-4 space-y-4">
            <SmtpSettings />
          </TabsContent>

          <TabsContent value="payments" className="mt-4 space-y-4">
            <PaymentDetails />
          </TabsContent>

          <TabsContent value="storage" className="mt-4 space-y-4">
            <StorageSettings />
          </TabsContent>
          {isAdmin && <TabsContent value="media" className="mt-4 space-y-4"><MediaBrowser /></TabsContent>}
          {isAdmin && <TabsContent value="archive" className="mt-4 space-y-4"><ArchiveSettings /></TabsContent>}

          <TabsContent value="data" className="mt-4 space-y-4">
            <div className="rounded-xl border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Database className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-lg font-semibold">Data management</h2>
              </div>
              <div className="space-y-4">
                <div>
                  <Button variant="outline" onClick={handleExport}>
                    <Download className="mr-2 h-4 w-4" />
                    View loaded records
                  </Button>
                  {exportData && (
                    <Textarea
                      value={exportData}
                      readOnly
                      className="mt-2 h-32 font-mono text-xs"
                    />
                  )}
                </div>
                <div>
                  <Textarea
                    aria-label="Temporary JSON preview"
                    aria-invalid={Boolean(importError)}
                    aria-describedby={importError ? "preview-import-error" : undefined}
                    placeholder="Temporary JSON preview (not saved)..."
                    value={importData}
                    onChange={(e) => setImportData(e.target.value)}
                    className="h-32 font-mono text-xs"
                  />
                  <Button className="mt-2" variant="outline" onClick={handleImport}>
                    <Upload className="mr-2 h-4 w-4" />
                    Load temporary preview
                  </Button>
                  {importError && <p id="preview-import-error" role="alert" className="mt-2 text-sm text-destructive">{importError}</p>}
                </div>
                <div className="border-t pt-4">
                  <Button variant="outline" disabled={reloading} onClick={handleReset}>
                    <Database className="mr-2 h-4 w-4" />
                    {reloading ? "Reloading…" : "Reload records"}
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="automation" className="mt-4 space-y-4">
            <AutomationCentre />
          </TabsContent>

          <TabsContent value="health" className="mt-4 space-y-4">
            <SystemHealth />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

function BranchPrefixManager() {
  const [rows, setRows] = useState(getAllBranchPrefixes());
  const [code, setCode] = useState("");
  const [name, setName] = useState("");

  function refresh() {
    setRows(getAllBranchPrefixes());
  }

  function handleAdd() {
    const c = code.trim().toUpperCase();
    if (!c || !name.trim()) return;
    if (rows.some((r) => r.code.toUpperCase() === c)) return;
    addBranchPrefix({ code: c, name: name.trim(), active: true });
    setCode("");
    setName("");
    refresh();
  }

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="mb-1 flex items-center gap-2">
        <Building className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Branch prefixes (P-File Number)</h2>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Each branch keeps its own sequence, e.g. BS1, BS2 … / V1, V2 … / P1, P2 …
      </p>

      <div className="space-y-2">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No prefixes configured yet.</p>
        ) : (
          rows.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-2">
              <Input
                aria-label={`Prefix code for ${r.name || r.code}`}
                className="w-24"
                value={r.code}
                onChange={(e) => {
                  updateBranchPrefix(r.id, { code: e.target.value.toUpperCase() });
                  refresh();
                }}
              />
              <Input
                aria-label={`Branch name for prefix ${r.code}`}
                className="min-w-40 flex-1"
                value={r.name}
                onChange={(e) => {
                  updateBranchPrefix(r.id, { name: e.target.value });
                  refresh();
                }}
              />
              <Button
                variant="outline"
                size="sm"
                aria-label={`Active prefix ${r.code}`}
                aria-pressed={r.active}
                onClick={() => {
                  updateBranchPrefix(r.id, { active: !r.active });
                  refresh();
                }}
              >
                {r.active ? "Active" : "Inactive"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  deleteBranchPrefix(r.id);
                  refresh();
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-2">
        <div className="space-y-2">
          <Label htmlFor="newPrefixCode">Prefix</Label>
          <Input id="newPrefixCode" className="w-24" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="BS" />
        </div>
        <div className="space-y-2 flex-1 min-w-40">
          <Label htmlFor="newPrefixName">Branch / company</Label>
          <Input id="newPrefixName" value={name} onChange={(e) => setName(e.target.value)} placeholder="BSM Engineering" />
        </div>
        <Button onClick={handleAdd}>Add prefix</Button>
      </div>
    </div>
  );
}
