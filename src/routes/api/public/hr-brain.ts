import { createFileRoute } from "@tanstack/react-router";
import { handleHrBrain } from "@/lib/hr-brain.server";
import { verifyUser, isAdmin } from "@/lib/r2.server";

function handle(request: Request) {
  return handleHrBrain(request, {
    verifyUser, isAdmin, fetch,
    apiKey: () => process.env["HR_BRAIN_API_KEY"],
    baseUrl: () => process.env["HR_BRAIN_BASE_URL"],
  });
}

export const Route = createFileRoute("/api/public/hr-brain")({
  server: { handlers: {
    POST: ({ request }) => handle(request),
    OPTIONS: ({ request }) => handle(request),
  } },
});