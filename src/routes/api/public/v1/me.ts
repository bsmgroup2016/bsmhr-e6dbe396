import { createFileRoute } from "@tanstack/react-router";
import { fromEmployee } from "@/lib/db";
import { ok, preflight, requireAuth, sbSelect } from "@/lib/api-v1.server";

/** Session bootstrap for any client: identity, roles, linked worker profile. */
export const Route = createFileRoute("/api/public/v1/me")({
  server: {
    handlers: {
      OPTIONS: preflight,
      GET: async ({ request }) => {
        const auth = await requireAuth(request);
        if ("response" in auth) return auth.response;
        const { ctx } = auth;

        const [profile, employee, companies] = await Promise.all([
          sbSelect<Record<string, unknown>>(
            ctx,
            `profiles?select=id,full_name,username,avatar_url,email&id=eq.${ctx.userId}&limit=1`,
          ),
          ctx.employeeId
            ? sbSelect<Record<string, unknown>>(ctx, `employees?select=*&id=eq.${ctx.employeeId}&limit=1`)
            : Promise.resolve([]),
          sbSelect<Record<string, unknown>>(ctx, `companies?select=id,name,code&order=name`),
        ]);

        return ok({
          userId: ctx.userId,
          email: ctx.email,
          roles: ctx.roles,
          profile: profile[0] ?? null,
          employee: employee[0] ? fromEmployee(employee[0]) : null,
          companies,
        });
      },
    },
  },
});