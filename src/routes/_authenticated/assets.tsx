import { createFileRoute } from "@tanstack/react-router";

import { ComingSoon } from "@/components/coming-soon";

export const Route = createFileRoute("/_authenticated/assets")({
  head: () => ({
    meta: [
      { title: "Assets & PPE — BSM Workforce & Operations" },
      { name: "description", content: "Tools, equipment and PPE issuance tracking per worker and site." },
      { property: "og:title", content: "Assets & PPE — BSM Workforce & Operations" },
      { property: "og:description", content: "Tools, equipment and PPE issuance tracking per worker and site." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <ComingSoon
      title="Assets & PPE"
      description="Tools, equipment and PPE issuance tracking per worker and site."
      phase="Phase 18 · Coming soon"
      planned={[
        "Asset register",
        "PPE issuance",
        "Return & condition log",
        "Calibration schedule",
        "Loss / damage reports",
        "Site-wise stock",
      ]}
    />
  ),
});
