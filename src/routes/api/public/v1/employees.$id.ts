import { createFileRoute } from "@tanstack/react-router";
import { fromEmployee } from "@/lib/db";
import {
  fail,
  hasAnyRole,
  ok,
  preflight,
  requireAuth,
  sbSelect,
} from "@/lib/api-v1.server";

/** Single employee. Workers may read only their own record. */
export const Route = createFileRoute("/api/public/v1/employees/$id")({
  server: {
    handlers: {
      OPTIONS: preflight,
      GET: async ({ request, params }) => {
        const auth = await requireAuth(request);
        if ("response" in auth) return auth.response;
        const { ctx } = auth;

        const isStaff = hasAnyRole(ctx, ["admin", "hr", "manager", "supervisor"]);
        if (!isStaff && ctx.employeeId !== params.id)
          return fail(403, "forbidden", "You can only view your own profile");

        const rows = await sbSelect<Record<string, unknown>>(
          ctx,
          `employees?select=*&id=eq.${encodeURIComponent(params.id)}&limit=1`,
        );
        if (!rows[0]) return fail(404, "not_found", "Employee not found");
        return ok(fromEmployee(rows[0]));
      },
    },
  },
});