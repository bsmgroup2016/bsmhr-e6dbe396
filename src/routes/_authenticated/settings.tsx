import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
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
} from "lucide-react";

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
import { getBranches, getCurrentBranch, setCurrentBranch, exportState, importState, resetState } from "@/lib/store";
import { checkR2Status } from "@/lib/r2";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — BSM Workforce & Operations" },
      { name: "description", content: "System settings and configuration." },
      { property: "og:title", content: "Settings — BSM Workforce & Operations" },
      { property: "og:description", content: "System settings and configuration." },
    ],
  }),
  component: SettingsPage,
});

export default function SettingsPage() {
  const branches = getBranches();
  const [currentBranch, setBranch] = useState(getCurrentBranch());
  const [exportData, setExportData] = useState("");
  const [importData, setImportData] = useState("");
  const [saved, setSaved] = useState(false);
  const [r2Test, setR2Test] = useState<string | null>(null);

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
    try {
      importState(importData);
      setImportData("");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      alert("Invalid JSON data");
    }
  }

  function handleReset() {
    if (confirm("This will clear all local data and restore defaults. Continue?")) {
      resetState();
      window.location.reload();
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground">Configure system preferences and manage data.</p>
        </div>

        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-5 sm:w-auto">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="storage">Storage</TabsTrigger>
            <TabsTrigger value="data">Data</TabsTrigger>
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
                    <SelectTrigger>
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
                  <Input id="companyName" defaultValue="BSM Engineering Pte Ltd" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="uen">UEN</Label>
                  <Input id="uen" defaultValue="201234567A" />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="address">Address</Label>
                  <Input id="address" defaultValue="Singapore" />
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="notifications" className="mt-4 space-y-4">
            <div className="rounded-xl border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Bell className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-lg font-semibold">Alerts</h2>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Pass expiry alerts</p>
                    <p className="text-sm text-muted-foreground">Notify before work passes expire.</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Approval notifications</p>
                    <p className="text-sm text-muted-foreground">Email when a request needs approval.</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Payroll reminders</p>
                    <p className="text-sm text-muted-foreground">Remind before payroll deadline.</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="security" className="mt-4 space-y-4">
            <div className="rounded-xl border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-lg font-semibold">Access</h2>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Require approval for assignments</p>
                    <p className="text-sm text-muted-foreground">All assignments go through approval workflow.</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Audit logging</p>
                    <p className="text-sm text-muted-foreground">Record all data changes.</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="storage" className="mt-4 space-y-4">
            <div className="rounded-xl border bg-card p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <HardDrive className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-lg font-semibold">Cloudflare R2 file storage</h2>
              </div>
              <p className="mb-4 text-sm text-muted-foreground">
                All uploaded files (work permits, ICs, certificates, time cards) are stored in your
                Cloudflare R2 bucket. Your R2 keys are saved securely as project secrets — nothing to
                fill in here. Only the file link is saved in the database.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" onClick={handleTestR2}>
                  Test R2 connection
                </Button>
                {r2Test && <span className="text-sm text-muted-foreground">{r2Test}</span>}
              </div>
            </div>
          </TabsContent>

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
                    Export all data
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
                    placeholder="Paste exported JSON to import..."
                    value={importData}
                    onChange={(e) => setImportData(e.target.value)}
                    className="h-32 font-mono text-xs"
                  />
                  <Button className="mt-2" variant="outline" onClick={handleImport}>
                    <Upload className="mr-2 h-4 w-4" />
                    Import data
                  </Button>
                </div>
                <div className="border-t pt-4">
                  <Button variant="destructive" onClick={handleReset}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Reset to defaults
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
