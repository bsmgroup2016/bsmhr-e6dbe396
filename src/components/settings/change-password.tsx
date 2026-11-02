import { useState } from "react";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ChangePassword() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (newPassword !== confirmation) return toast.error("Passwords do not match.");
    setBusy(true);
    try {
      const { data, error: userError } = await supabase.auth.getUser();
      if (userError || !data.user?.email) throw new Error("Please sign in again.");
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: data.user.email,
        password: currentPassword,
      });
      if (authError) throw new Error("Current password is incorrect.");
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setCurrentPassword("");
      setNewPassword("");
      setConfirmation("");
      toast.success("Password changed successfully.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not change password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <KeyRound className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Change password</h2>
      </div>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="settings-current-password">Current password</Label>
          <Input id="settings-current-password" type="password" autoComplete="current-password" required disabled={busy} value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="settings-new-password">New password</Label>
          <Input id="settings-new-password" type="password" autoComplete="new-password" required disabled={busy} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="settings-confirm-password">Confirm new password</Label>
          <Input id="settings-confirm-password" type="password" autoComplete="new-password" required disabled={busy} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={busy}>
            <KeyRound className="mr-2 h-4 w-4" />
            {busy ? "Verifying…" : "Change password"}
          </Button>
        </div>
      </form>
    </section>
  );
}