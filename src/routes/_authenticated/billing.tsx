import { createFileRoute } from "@tanstack/react-router";

import { ComingSoon } from "@/components/coming-soon";

export const Route = createFileRoute("/_authenticated/billing")({
  head: () => ({
    meta: [
      { title: "Billing & Invoicing — BSM Workforce & Operations" },
      { name: "description", content: "Client billing based on deployed manpower, timesheets and rate agreements." },
      { property: "og:title", content: "Billing & Invoicing — BSM Workforce & Operations" },
      { property: "og:description", content: "Client billing based on deployed manpower, timesheets and rate agreements." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <ComingSoon
      title="Billing & Invoicing"
      description="Client billing based on deployed manpower, timesheets and rate agreements."
      phase="Phase 16 · Coming soon"
      planned={[
        "Rate agreements",
        "Timesheet-based billing",
        "Invoice generation",
        "GST handling",
        "Payment tracking",
        "Statement of account",
      ]}
    />
  ),
});
