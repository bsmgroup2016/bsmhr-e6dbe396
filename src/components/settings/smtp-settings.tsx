import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Mail, Save, Send, Loader2, Eye, EyeOff, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getSmtpSettings,
  saveSmtpSettings,
  testSmtpSettings,
} from "@/lib/smtp-settings.functions";

export function SmtpSettings() {
  const qc = useQueryClient();
  const load = useServerFn(getSmtpSettings);
  const save = useServerFn(saveSmtpSettings);
  const test = useServerFn(testSmtpSettings);

  const { data, isLoading } = useQuery({ queryKey: ["smtp-settings"], queryFn: () => load() });

  const [form, setForm] = useState({
    enabled: false,
    primaryProvider: "resend" as "resend" | "smtp",
    host: "",
    port: 587,
    secure: false,
    username: "",
    password: "",
    fromEmail: "",
    fromName: "",
    maxAttempts: 3,
    retryDelayMs: 1000,
    backoffMultiplier: 2,
    failoverEnabled: true,
    switchBack: true,
  });
  const [showKey, setShowKey] = useState(false);
  const [testTo, setTestTo] = useState("");

  useEffect(() => {
    if (!data) return;
    setForm({
      enabled: data.enabled,
      primaryProvider: data.primaryProvider,
      host: data.host ?? "",
      port: data.port ?? 587,
      secure: data.secure,
      username: data.username ?? "",
      password: "",
      fromEmail: data.fromEmail ?? "",
      fromName: data.fromName ?? "",
      maxAttempts: data.maxAttempts ?? 3,
      retryDelayMs: data.retryDelayMs ?? 1000,
      backoffMultiplier: data.backoffMultiplier ?? 2,
      failoverEnabled: data.failoverEnabled ?? true,
      switchBack: data.switchBack ?? true,
    });
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () => save({ data: form }),
    onSuccess: (res: any) => {
      if (res.success) {
        toast.success("SMTP settings saved");
        setForm((f) => ({ ...f, password: "" }));
        qc.invalidateQueries({ queryKey: ["smtp-settings"] });
      } else toast.error(res.error || "Could not save settings");
    },
    onError: () => toast.error("Could not save settings"),
  });

  const testMutation = useMutation({
    mutationFn: () => test({ data: { to: testTo } }),
    onSuccess: (res: any) => {
      if (res.success) toast.success(`Test email sent to ${testTo}`);
      else toast.error(`Test failed: ${res.error}`);
    },
    onError: () => toast.error("Test failed"),
  });

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Email delivery</h2>
          </div>
          {data?.usable ? (
            <Badge variant="secondary" className="gap-1">
              <CheckCircle2 className="h-3 w-3" /> SMTP ready
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1">
              <AlertCircle className="h-3 w-3" /> SMTP not configured
            </Badge>
          )}
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          Resend is used by default. If a send fails, the system automatically retries through your
          own SMTP server. You can also make SMTP the primary sender.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Primary sender</Label>
            <Select
              value={form.primaryProvider}
              onValueChange={(v) => set("primaryProvider", v as "resend" | "smtp")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="resend">Resend API (fallback: SMTP)</SelectItem>
                <SelectItem value="smtp">My SMTP server (fallback: Resend)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end justify-between rounded-lg border bg-background/50 p-4">
            <div>
              <p className="text-sm font-medium">Enable SMTP</p>
              <p className="text-xs text-muted-foreground">Allow sending through your server.</p>
            </div>
            <Switch checked={form.enabled} onCheckedChange={(v) => set("enabled", v)} />
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">SMTP server</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="smtp-host">Host</Label>
            <Input
              id="smtp-host"
              placeholder="smtp.yourdomain.com"
              value={form.host}
              onChange={(e) => set("host", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="smtp-port">Port</Label>
            <Input
              id="smtp-port"
              type="number"
              value={form.port}
              onChange={(e) => set("port", Number(e.target.value) || 587)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="smtp-user">Username</Label>
            <Input
              id="smtp-user"
              placeholder="notifications@yourdomain.com"
              value={form.username}
              onChange={(e) => set("username", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="smtp-pass">Password / API key</Label>
            <div className="flex gap-2">
              <Input
                id="smtp-pass"
                type={showKey ? "text" : "password"}
                placeholder={data?.hasPassword ? "•••••••• (saved)" : "Enter password"}
                value={form.password}
                onChange={(e) => set("password", e.target.value)}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setShowKey((s) => !s)}
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="smtp-from">From email</Label>
            <Input
              id="smtp-from"
              placeholder="no-reply@yourdomain.com"
              value={form.fromEmail}
              onChange={(e) => set("fromEmail", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="smtp-fromname">From name</Label>
            <Input
              id="smtp-fromname"
              placeholder="BSM Workforce"
              value={form.fromName}
              onChange={(e) => set("fromName", e.target.value)}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border bg-background/50 p-4 sm:col-span-2">
            <div>
              <p className="text-sm font-medium">Use implicit TLS (SSL)</p>
              <p className="text-xs text-muted-foreground">
                On for port 465. Leave off for port 587 (STARTTLS).
              </p>
            </div>
            <Switch checked={form.secure} onCheckedChange={(v) => set("secure", v)} />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || isLoading}>
            {saveMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save settings
          </Button>
          <Input
            className="w-56"
            placeholder="test@example.com"
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
          />
          <Button
            variant="outline"
            onClick={() => testMutation.mutate()}
            disabled={testMutation.isPending || !testTo}
          >
            {testMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Send test email
          </Button>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <h2 className="mb-1 text-lg font-semibold">Failover & retry</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          If the primary sender fails, each send is retried with exponential backoff, then
          automatically switched to the other sender. Retry delay grows by the multiplier on every
          attempt.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="smtp-attempts">Attempts per sender</Label>
            <Input
              id="smtp-attempts"
              type="number"
              min={1}
              max={10}
              value={form.maxAttempts}
              onChange={(e) => set("maxAttempts", Math.max(1, Number(e.target.value) || 1))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="smtp-delay">Initial retry delay (ms)</Label>
            <Input
              id="smtp-delay"
              type="number"
              min={0}
              max={60000}
              step={500}
              value={form.retryDelayMs}
              onChange={(e) => set("retryDelayMs", Math.max(0, Number(e.target.value) || 0))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="smtp-backoff">Backoff multiplier</Label>
            <Input
              id="smtp-backoff"
              type="number"
              min={1}
              max={10}
              step={0.5}
              value={form.backoffMultiplier}
              onChange={(e) => set("backoffMultiplier", Math.max(1, Number(e.target.value) || 1))}
            />
          </div>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="flex items-center justify-between rounded-lg border bg-background/50 p-4">
            <div>
              <p className="text-sm font-medium">Automatic failover</p>
              <p className="text-xs text-muted-foreground">
                Switch to the other sender when the primary keeps failing.
              </p>
            </div>
            <Switch
              checked={form.failoverEnabled}
              onCheckedChange={(v) => set("failoverEnabled", v)}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border bg-background/50 p-4">
            <div>
              <p className="text-sm font-medium">Switch back and retry</p>
              <p className="text-xs text-muted-foreground">
                After the backup also fails, try the primary sender one more round.
              </p>
            </div>
            <Switch checked={form.switchBack} onCheckedChange={(v) => set("switchBack", v)} />
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Order: {form.primaryProvider === "smtp" ? "SMTP" : "Resend"} x {form.maxAttempts}
          {form.failoverEnabled
            ? ` -> ${form.primaryProvider === "smtp" ? "Resend" : "SMTP"} x ${form.maxAttempts}${form.switchBack ? ` -> ${form.primaryProvider === "smtp" ? "SMTP" : "Resend"} x ${form.maxAttempts}` : ""}`
            : ""}
        </p>
      </div>

      <div>
        {data?.updatedAt && (
          <p className="mt-3 text-xs text-muted-foreground">
            Last updated {new Date(data.updatedAt).toLocaleString()}
          </p>
        )}
      </div>
    </div>
  );
}