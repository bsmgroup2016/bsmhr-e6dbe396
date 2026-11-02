import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin Sign in — BSM Workforce & Operations" },
      { name: "description", content: "Restricted administrator sign-in for BSM Workforce & Operations." },
      { property: "og:title", content: "Admin Sign in — BSM Workforce & Operations" },
      { property: "og:description", content: "Restricted administrator sign-in for BSM Workforce & Operations." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminLoginPage,
});

function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err || !data.user) {
      setLoading(false);
      setError(err?.message ?? "Sign in failed.");
      return;
    }
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id);
    const isAdmin = (roles ?? []).some((r: { role: string }) => r.role === "admin");
    if (!isAdmin) {
      await supabase.auth.signOut();
      setLoading(false);
      setError("This account is not an administrator. Please use the regular sign-in page.");
      return;
    }
    window.location.href = "/dashboard";
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-background via-background to-muted/40 p-4">
      <Card className="w-full max-w-md border border-border/60 shadow-elegant">
        <CardHeader className="space-y-1">
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-primary text-primary-foreground">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <CardTitle className="text-xl font-semibold">Administrator Sign in</CardTitle>
          <CardDescription>Restricted area. Admin accounts only.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-email">Email</Label>
              <Input id="admin-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-password">Password</Label>
              <Input id="admin-password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sign in as Admin
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
