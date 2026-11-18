import { Link, createFileRoute } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { BSM_LOGO_URL } from "@/lib/brand";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — BSM Engineering Workforce & Operations" },
      {
        name: "description",
        content:
          "How BSM Engineering collects, uses and protects worker and visitor data, including location captured only at duty check-in and check-out.",
      },
      { property: "og:title", content: "Privacy Policy — BSM Engineering" },
      {
        property: "og:description",
        content:
          "How BSM Engineering collects, uses and protects worker and visitor data. Worker location is recorded only at duty check-in/check-out and is never sold or shared.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PrivacyPage,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-5 py-4">
          <img
            src={BSM_LOGO_URL}
            alt="BSM Engineering logo"
            className="h-10 w-10 rounded-xl bg-white object-contain p-1"
          />
          <div>
            <p className="text-sm font-semibold text-foreground">BSM Engineering</p>
            <p className="text-xs text-muted-foreground">Workforce & Operations Management</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-8 px-5 py-10">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-primary">
            <ShieldCheck className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase tracking-wider">Privacy Policy</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Your privacy at BSM Engineering
          </h1>
          <p className="text-sm text-muted-foreground">Last updated: 18 November 2026</p>
        </div>

        <Section title="Who we are">
          <p>
            BSM Engineering is a Singapore-based manpower supply company serving the construction,
            petrochemical and marine industries. This policy explains what information our workforce
            management system ("the app") collects, why, and how it is protected.
          </p>
        </Section>

        <Section title="Information we collect">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong className="text-foreground">Account details</strong> — your name, login ID or
              email, and a securely hashed password, so you can sign in.
            </li>
            <li>
              <strong className="text-foreground">Employment records</strong> — work permit and
              passport details, designation, salary, attendance, leave and payroll information that
              your employer maintains to manage your employment.
            </li>
            <li>
              <strong className="text-foreground">Photos and documents</strong> — profile photos,
              attendance selfies, time-card scans and documents you or your employer upload.
            </li>
            <li>
              <strong className="text-foreground">Location at punch only</strong> — see the next
              section.
            </li>
          </ul>
        </Section>

        <Section title="Location: only when you check in or out">
          <p>
            Your device's location is recorded <strong className="text-foreground">only at the
            moment you press Check in or Check out</strong>, to verify that the attendance punch was
            made at the work site. We do not track your location continuously, in the background, or
            at any other time.
          </p>
          <p>
            Location data is used solely for attendance verification. It is{" "}
            <strong className="text-foreground">never sold, rented or shared</strong> with any third
            party, and it is not used for advertising or profiling.
          </p>
        </Section>

        <Section title="How your data is stored">
          <p>
            Employment and account records are kept in a secured database with row-level access
            controls, so each person can only reach the records their role allows. Photos, scans and
            documents are stored in encrypted cloud file storage (Cloudflare R2). Access to the
            system requires sign-in, and administrative actions are limited to authorised staff.
          </p>
        </Section>

        <Section title="Who we share data with">
          <p>
            We do not sell or share personal data with advertisers or data brokers. Data is processed
            only by the service providers that operate the system on our behalf — cloud hosting and
            database (Supabase), file storage (Cloudflare), email delivery, and website analytics
            (Lovable, described below) — each under their own privacy obligations.
          </p>
        </Section>

        <Section title="Website visitor analytics">
          <p>
            This site uses Lovable's built-in visitor analytics. It uses no cookies, stores nothing
            on your device, does not keep your IP address and does not identify you. Lovable collects
            this data for us.{" "}
            <a
              href="https://lovable.dev/privacy"
              target="_blank"
              rel="noreferrer"
              className="text-primary underline-offset-4 hover:underline"
            >
              Lovable's privacy policy
            </a>{" "}
            explains how it handles it.
          </p>
          <p>
            For every visitor it records the pages visited, where visitors came from, their country,
            browser, operating system and device type, how long they stay, how fast pages load,
            errors, and which buttons and links are clicked. Detailed data is kept for 90 days and
            daily summaries for one year.
          </p>
        </Section>

        <Section title="Data retention and your rights">
          <p>
            Employment records are retained for as long as required for employment, payroll and
            regulatory purposes in Singapore. You may ask your employer's HR administrator to review
            or correct your records, or contact us using the details below.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions about this policy or your data:{" "}
            <a
              href="mailto:bsmgroup2016@gmail.com"
              className="text-primary underline-offset-4 hover:underline"
            >
              bsmgroup2016@gmail.com
            </a>
            .
          </p>
        </Section>

        <div className="border-t border-border pt-6">
          <Link
            to="/auth"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            ← Back to sign in
          </Link>
        </div>
      </main>
    </div>
  );
}
