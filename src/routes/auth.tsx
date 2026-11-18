import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, Building2, KeyRound, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BSM_LOGO_URL } from "@/lib/brand";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — BSM Workforce & Operations" },
      { name: "description", content: "Sign in to BSM Engineering workforce management system." },
      { property: "og:title", content: "Sign in — BSM Workforce & Operations" },
      { property: "og:description", content: "Sign in to BSM Engineering workforce management system." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  // If already authenticated, redirect to dashboard
  if (isAuthenticated && !isLoading) {
    router.navigate({ to: "/dashboard" });
  }

  return (
    <div className="worker-app relative flex min-h-screen items-center justify-center overflow-hidden p-4 lg:p-8">
      <div aria-hidden className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-brand-lime/30 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-40 -right-24 h-[28rem] w-[28rem] rounded-full bg-primary/20 blur-3xl" />
      <div className="relative grid w-full max-w-5xl overflow-hidden rounded-3xl bg-card shadow-[var(--wa-shadow)] lg:grid-cols-2">
        <section className="wa-hero relative hidden flex-col justify-between overflow-hidden p-10 text-primary-foreground lg:flex">
          <div aria-hidden className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-brand-lime/30 blur-3xl" />
          <div className="relative flex items-center gap-3">
            <img src={BSM_LOGO_URL} alt="BSM Engineering logo" className="h-12 w-12 rounded-2xl object-cover shadow-md" />
            <div><p className="text-lg font-semibold">BSM Engineering</p><p className="text-xs opacity-80">Workforce & Operations Management</p></div>
          </div>
          <div className="relative space-y-4">
            <h2 className="text-3xl font-semibold leading-tight">Your workforce,<br />one secure place.</h2>
            <p className="max-w-sm text-sm opacity-80">Attendance, leave, payslips and site operations for Singapore manpower teams.</p>
            <div className="grid grid-cols-3 gap-3 pt-2">
              {["Attendance", "Payroll", "Projects"].map((t) => <div key={t} className="wa-glass rounded-xl px-3 py-2 text-center text-xs font-medium">{t}</div>)}
            </div>
          </div>
          <p className="relative text-xs opacity-70">Singapore manpower supply · Secure sign-in required</p>
        </section>
        <section className="flex flex-col items-center justify-center p-5 sm:p-10">
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <img src={BSM_LOGO_URL} alt="BSM Engineering logo" className="h-11 w-11 rounded-2xl object-cover shadow-md" />
            <div><h1 className="text-lg font-semibold tracking-tight">BSM Engineering</h1><p className="text-xs text-muted-foreground">Workforce & Operations Management</p></div>
          </div>
          <AuthCard />
          <p className="mt-4 text-center text-xs text-muted-foreground">
            By signing in you agree to our{" "}
            <Link to="/privacy" className="font-medium text-primary underline-offset-4 hover:underline">
              Privacy Policy
            </Link>
            . Location is recorded only at check-in/check-out.
          </p>
        </section>
      </div>
    </div>
  );
}

function AuthCard() {
  const { signIn, signUp } = useAuth();
  const [activeTab, setActiveTab] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    const { error: err } = await signIn(email, password);
    if (err) {
      setLoading(false);
      setError(err.message);
      return;
    }
    const { data: u } = await supabase.auth.getUser();
    if (u.user) {
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
      if ((roles ?? []).some((r: { role: string }) => r.role === "admin")) {
        await supabase.auth.signOut();
        setLoading(false);
        setError("Administrator accounts must sign in from the admin login page.");
        return;
      }
    }
    setLoading(false);
    setMessage("Signed in successfully. Redirecting...");
    window.location.href = "/";
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!/^[\d+\-\s()]{6,}$/.test(phone.trim())) {
      setError("Enter a valid phone number.");
      return;
    }
    setLoading(true);
    const { error: err } = await signUp(email, password, fullName || email.split("@")[0], phone.trim());
    setLoading(false);
    if (err) {
      setError(err.message);
    } else {
      setMessage(
        "Account created. Check your email to confirm, then sign in. An administrator will assign your role.",
      );
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (err) {
      setError(err.message);
    } else {
      setForgotSent(true);
    }
  };

  return (
    <Card className="w-full max-w-md border-0 shadow-none">
      <CardHeader className="space-y-1">
        <CardTitle className="text-xl font-semibold">Welcome back</CardTitle>
        <CardDescription>Sign in with your email or worker login ID.</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin">Sign in</TabsTrigger>
            <TabsTrigger value="signup">Sign up</TabsTrigger>
          </TabsList>
          <TabsContent value="signin">
            <form onSubmit={handleSignIn} className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="signin-email">Email / Worker login ID</Label>
                <Input
                  id="signin-email"
                  type="text"
                  autoComplete="username"
                  placeholder="Email or worker login ID"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signin-password">Password</Label>
                <Input
                  id="signin-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              {message && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{message}</AlertDescription>
                </Alert>
              )}
              <Button type="submit" className="wa-pink-btn h-11 w-full border-0 text-primary font-semibold" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Sign in
              </Button>
              <button
                type="button"
                className="mx-auto flex items-center gap-1.5 text-xs text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
                onClick={() => {
                  setForgotSent(false);
                  setError(null);
                  setMessage(null);
                  setActiveTab("forgot");
                }}
              >
                <KeyRound className="h-3.5 w-3.5" />
                Forgot password?
              </button>
            </form>
          </TabsContent>
          <TabsContent value="signup">
            <form onSubmit={handleSignUp} className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="signup-email">Email</Label>
                <Input
                  id="signup-email"
                  type="email"
                  placeholder="admin@bsm.sg"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-phone">Phone number</Label>
                <Input
                  id="signup-phone"
                  type="tel"
                  inputMode="tel"
                  placeholder="+65 8123 4567"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-password">Password</Label>
                <Input
                  id="signup-password"
                  type="password"
                  minLength={6}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-confirm">Confirm password</Label>
                <Input
                  id="signup-confirm"
                  type="password"
                  minLength={6}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              {message && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{message}</AlertDescription>
                </Alert>
              )}
              <Button type="submit" className="wa-pink-btn h-11 w-full border-0 text-primary font-semibold" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Create account
              </Button>
            </form>
          </TabsContent>
          <TabsContent value="forgot">
            {forgotSent ? (
              <Alert className="mt-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Reset link sent to <span className="font-medium">{email}</span>. Open the email
                  and click the link to set a new password. The link works only once and expires
                  within an hour.
                </AlertDescription>
              </Alert>
            ) : (
              <form onSubmit={handleForgot} className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="forgot-email">Account email</Label>
                  <Input
                    id="forgot-email"
                    type="email"
                    placeholder="admin@bsm.sg"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <Button type="submit" className="wa-pink-btn h-11 w-full border-0 text-primary font-semibold" disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Send reset link
                </Button>
              </form>
            )}
            <button
              type="button"
              className="mx-auto mt-3 flex text-xs text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
              onClick={() => {
                setActiveTab("signin");
                setForgotSent(false);
                setError(null);
              }}
            >
              Back to sign in
            </button>
          </TabsContent>
        </Tabs>
      </CardContent>
      <CardFooter className="text-center text-xs text-muted-foreground">
        <p className="w-full">
          New accounts need admin approval before accessing workforce data.
        </p>
      </CardFooter>
    </Card>
  );
}
