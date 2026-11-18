import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { BSM_LOGO_URL } from "@/lib/brand";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset password — BSM Workforce & Operations" },
      { name: "description", content: "Set a new password for your BSM account." },
      { property: "og:title", content: "Reset password — BSM Workforce & Operations" },
      { property: "og:description", content: "Set a new password for your BSM account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const router = useRouter();
  const [stage, setStage] = useState<"checking" | "form" | "invalid">("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Supabase-js detects the recovery token in the URL hash and signs the
    // user in automatically; give it a moment before checking the session.
    const timer = setTimeout(async () => {
      const { data } = await supabase.auth.getSession();
      setStage(data.session ? "form" : "invalid");
    }, 1200);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    // Recovery sessions are exempt from current-password checks.
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    setDone(true);
    setTimeout(() => router.navigate({ to: "/auth" }), 2500);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-background via-background to-muted/40 p-4">
      <div className="mb-6 flex items-center gap-3">
        <img
          src={BSM_LOGO_URL}
          alt="BSM Engineering logo"
          className="h-10 w-10 rounded-lg bg-white object-contain p-1 shadow-elegant"
        />
        <div>
          <h1 className="text-lg font-semibold tracking-tight">BSM Engineering</h1>
          <p className="text-xs text-muted-foreground">Workforce &amp; Operations Management</p>
        </div>
      </div>
      <Card className="w-full max-w-md border border-border/60 shadow-elegant">
        <CardHeader className="space-y-1">
          <CardTitle className="text-xl font-semibold">Set a new password</CardTitle>
          <CardDescription>Choose a strong password of at least 8 characters.</CardDescription>
        </CardHeader>
        <CardContent>
          {stage === "checking" && (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Verifying your reset link…
            </div>
          )}
          {stage === "invalid" && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This reset link is invalid or has expired. Please request a new one from the
                sign-in page.
              </AlertDescription>
            </Alert>
          )}
          {stage === "form" && done && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                Password updated successfully. Redirecting you to the sign-in page…
              </AlertDescription>
            </Alert>
          )}
          {stage === "form" && !done && (
            <form onSubmit={handleSubmit} className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="reset-password">New password</Label>
                <Input
                  id="reset-password"
                  type="password"
                  minLength={8}
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reset-confirm">Confirm new password</Label>
                <Input
                  id="reset-confirm"
                  type="password"
                  minLength={8}
                  required
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </div>
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Update password
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
