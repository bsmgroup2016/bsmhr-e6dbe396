import { createFileRoute } from "@tanstack/react-router";
import { handleHrBrain } from "@/lib/hr-brain.server";
import { verifyUser, userRoles } from "@/lib/r2.server";

const STAFF = ["admin", "hr", "manager", "accounts", "it"];
const isStaff = async (id: string) => (await userRoles(id)).some((r) => STAFF.includes(r));

function handle(request: Request) {
  return handleHrBrain(request, {
    verifyUser, isAdmin: isStaff, fetch,
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