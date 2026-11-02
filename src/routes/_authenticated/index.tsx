import { createFileRoute, redirect } from "@tanstack/react-router";

// "/" is an alias for the dashboard: after sign-in users land on /dashboard.
export const Route = createFileRoute("/_authenticated/")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
});
