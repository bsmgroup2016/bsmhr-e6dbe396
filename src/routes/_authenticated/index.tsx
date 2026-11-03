import { createFileRoute, redirect } from "@tanstack/react-router";

// "/" is an alias for the dashboard: after sign-in users land on /dashboard.
export const Route = createFileRoute("/_authenticated/")({
  head: () => ({ meta: [
    { title: "Dashboard — BSM Workforce & Operations" },
    { name: "description", content: "BSM workforce and operations dashboard." },
    { property: "og:title", content: "Dashboard — BSM Workforce & Operations" },
    { property: "og:description", content: "BSM workforce and operations dashboard." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
});
