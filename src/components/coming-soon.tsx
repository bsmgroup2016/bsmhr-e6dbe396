import { AppShell } from "@/components/app-shell";
import { Sparkles } from "lucide-react";

interface ComingSoonProps {
  title: string;
  description: string;
  planned: string[];
  phase: string;
}

export function ComingSoon({ title, description, planned, phase }: ComingSoonProps) {
  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-hero p-6 shadow-elegant sm:p-8">
          <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
          <div className="relative flex flex-col gap-2">
            <span className="w-fit rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur">
              {phase}
            </span>
            <h1 className="text-3xl font-semibold tracking-tight text-white">{title}</h1>
            <p className="max-w-xl text-sm text-white/75">{description}</p>
          </div>
        </div>

        <div className="rounded-xl border bg-gradient-surface p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold text-foreground">Planned in this module</h2>
          </div>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {planned.map((item) => (
              <li
                key={item}
                className="rounded-lg border bg-card/60 px-3 py-2 text-sm text-muted-foreground"
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </AppShell>
  );
}