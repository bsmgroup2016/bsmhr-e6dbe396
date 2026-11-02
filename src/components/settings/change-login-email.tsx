import { useEffect, useState } from "react";
import { Mail } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ChangeLoginEmail() {
  const [current, setCurrent] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrent(data.user?.email ?? ""));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const next = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next)) return toast.error("Enter a valid email address");
    if (next === current.toLowerCase()) return toast.error("This is already your login email");
    setBusy(true);
    try {
      // Re-verify identity with current password before changing email
      const { error: authErr } = await supabase.auth.signInWithPassword({ email: current, password });
      if (authErr) throw new Error("Current password is incorrect");
      const { error } = await supabase.auth.updateUser(
        { email: next },
        { emailRedirectTo: window.location.origin },
      );
      if (error) throw error;
      toast.success("Confirmation sent. Click the link in both your old and new inbox to finish.");
      setEmail("");
      setPassword("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not change email");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <Mail className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Login email</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Current: <span className="font-medium text-foreground">{current || "—"}</span>
      </p>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="new-email">New email</Label>
          <Input id="new-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cur-pass">Current password</Label>
          <Input id="cur-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={busy}>{busy ? "Verifying…" : "Change email"}</Button>
        </div>
      </form>
    </div>
  );
}
