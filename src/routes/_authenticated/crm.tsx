import { createFileRoute } from "@tanstack/react-router";

import { ComingSoon } from "@/components/coming-soon";

export const Route = createFileRoute("/_authenticated/crm")({
  head: () => ({
    meta: [
      { title: "Client CRM — BSM Workforce & Operations" },
      { name: "description", content: "Leads, opportunities and client relationship tracking for manpower supply." },
      { property: "og:title", content: "Client CRM — BSM Workforce & Operations" },
      { property: "og:description", content: "Leads, opportunities and client relationship tracking for manpower supply." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <ComingSoon
      title="Client CRM"
      description="Leads, opportunities and client relationship tracking for manpower supply."
      phase="Phase 15 · Coming soon"
      planned={[
        "Lead capture",
        "Opportunity pipeline",
        "Quotations",
        "Client meetings log",
        "Follow-up reminders",
        "Win / loss analysis",
      ]}
    />
  ),
});
