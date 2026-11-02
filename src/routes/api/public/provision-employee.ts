import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/provision-employee")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { provisionEmployee, verifyToken } = await import("@/lib/provision.server");
        const user = await verifyToken(request);
        if (!user) return new Response("Unauthorized", { status: 401 });
        const { userRoles } = await import("@/lib/r2.server");
        const roles = await userRoles(user.id);
        if (!roles.includes("employee")) return new Response("Administrator approval required", { status: 403 });

        let phone = "";
        try {
          const body = (await request.json()) as { phone?: unknown };
          phone = String(body?.phone ?? "").slice(0, 32).replace(/[^\d+\-\s()]/g, "");
        } catch {
          phone = "";
        }

        try {
          const result = await provisionEmployee(
            user.id,
            user.email,
            phone,
            user.emailVerified,
          );
          return Response.json(result);
        } catch {
          return new Response("Provisioning failed", { status: 500 });
        }
      },
    },
  },
});
