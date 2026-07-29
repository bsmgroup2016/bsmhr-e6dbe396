import { createFileRoute } from "@tanstack/react-router";

import { ComingSoon } from "@/components/coming-soon";

export const Route = createFileRoute("/_authenticated/accommodation")({
  head: () => ({
    meta: [
      { title: "Accommodation — BSM Workforce & Operations" },
      { name: "description", content: "Dormitory and housing allocation, room occupancy and inspections." },
      { property: "og:title", content: "Accommodation — BSM Workforce & Operations" },
      { property: "og:description", content: "Dormitory and housing allocation, room occupancy and inspections." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <ComingSoon
      title="Accommodation"
      description="Dormitory and housing allocation, room occupancy and inspections."
      phase="Phase 17 · Coming soon"
      planned={[
        "Dormitory master",
        "Room allocation",
        "Occupancy tracking",
        "Rent & utilities",
        "Inspection records",
        "Move in / move out",
      ]}
    />
  ),
});
