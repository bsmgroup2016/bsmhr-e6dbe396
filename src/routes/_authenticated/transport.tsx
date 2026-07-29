import { createFileRoute } from "@tanstack/react-router";

import { ComingSoon } from "@/components/coming-soon";

export const Route = createFileRoute("/_authenticated/transport")({
  head: () => ({
    meta: [
      { title: "Transport & Drivers — BSM Workforce & Operations" },
      { name: "description", content: "Vehicles, drivers, daily trip planning and site transport scheduling." },
      { property: "og:title", content: "Transport & Drivers — BSM Workforce & Operations" },
      { property: "og:description", content: "Vehicles, drivers, daily trip planning and site transport scheduling." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <ComingSoon
      title="Transport & Drivers"
      description="Vehicles, drivers, daily trip planning and site transport scheduling."
      phase="Phase 18 · Coming soon"
      planned={[
        "Vehicle master",
        "Driver assignment",
        "Trip scheduling",
        "Road tax & insurance alerts",
        "Fuel & maintenance log",
        "Site pickup routes",
      ]}
    />
  ),
});
