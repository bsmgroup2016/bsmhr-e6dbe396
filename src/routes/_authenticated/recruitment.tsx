import { createFileRoute } from "@tanstack/react-router";

import { ComingSoon } from "@/components/coming-soon";

export const Route = createFileRoute("/_authenticated/recruitment")({
  head: () => ({
    meta: [
      { title: "Recruitment — BSM Workforce & Operations" },
      { name: "description", content: "Candidate pipeline, interview scheduling and onboarding for new hires." },
      { property: "og:title", content: "Recruitment — BSM Workforce & Operations" },
      { property: "og:description", content: "Candidate pipeline, interview scheduling and onboarding for new hires." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <ComingSoon
      title="Recruitment"
      description="Candidate pipeline, interview scheduling and onboarding for new hires."
      phase="Phase 14 · Coming soon"
      planned={[
        "Candidate database",
        "Job requisitions",
        "Interview scheduling",
        "Offer letters",
        "Onboarding checklist",
        "Agent / source tracking",
      ]}
    />
  ),
});
