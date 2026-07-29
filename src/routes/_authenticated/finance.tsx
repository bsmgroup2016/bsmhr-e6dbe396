import { createFileRoute } from "@tanstack/react-router";

import { ComingSoon } from "@/components/coming-soon";

export const Route = createFileRoute("/_authenticated/finance")({
  head: () => ({
    meta: [
      { title: "Finance — BSM Workforce & Operations" },
      { name: "description", content: "Company expenses, levy payments and financial summaries across entities." },
      { property: "og:title", content: "Finance — BSM Workforce & Operations" },
      { property: "og:description", content: "Company expenses, levy payments and financial summaries across entities." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <ComingSoon
      title="Finance"
      description="Company expenses, levy payments and financial summaries across entities."
      phase="Phase 18 · Coming soon"
      planned={[
        "Expense entries",
        "Levy payment tracking",
        "Cash flow summary",
        "Company-wise P&L view",
        "Budget vs actual",
        "Export to accounting",
      ]}
    />
  ),
});
