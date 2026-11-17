import { createFileRoute, redirect } from "@tanstack/react-router";

// The old ClaimSheet Generator page was retired: the Timecard to ClaimSheet page
// at /claim-generator replaces it. This alias keeps old bookmarks and shortcuts working.
export const Route = createFileRoute("/_authenticated/time-cards")({
  beforeLoad: () => {
    throw redirect({ to: "/claim-generator" });
  },
});
