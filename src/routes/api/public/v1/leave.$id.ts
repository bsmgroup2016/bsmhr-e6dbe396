import { createFileRoute } from "@tanstack/react-router";
import { fromLeave } from "@/lib/db";
import { keyFromRef } from "@/lib/r2.server";
import { fail, hasAnyRole, ok, preflight, readJson, requireAuth, sbRest } from "@/lib/api-v1.server";

type PatchBody = {
  /** Object keys or /api/public/r2-file links returned by POST /v1/uploads. */
  attachments?: string[];
  /** Replace instead of append. */
  replaceAttachments?: boolean;
  reason?: string;
  remarks?: string;
  /** Workers may only send "Cancelled"; staff may approve/reject. */
  status?: string;
};

const STAFF = ["admin", "hr", "manager"];

/** Single leave request: read, attach medical certificate, approve / cancel. */
export const Route = createFileRoute("/api/public/v1/leave/$id")({
  server: {
    handlers: {
      OPTIONS: preflight,

      GET: async ({ request, params }) => {
        const auth = await requireAuth(request);
        if ("response" in auth) return auth.response;
        const res = await sbRest(
          auth.ctx,
          `leave_requests?select=*&id=eq.${encodeURIComponent(params.id)}&limit=1`,
        );
        if (!res.ok) return fail(502, "upstream_error", "Unable to load leave request");
        const rows = (await res.json()) as Record<string, unknown>[];
        if (!rows[0]) return fail(404, "not_found", "Leave request not found");
        return ok(fromLeave(rows[0]));
      },

      PATCH: async ({ request, params }) => {
        const auth = await requireAuth(request);
        if ("response" in auth) return auth.response;
        const { ctx } = auth;
        const body = await readJson<PatchBody>(request);
        if (!body) return fail(400, "bad_request", "JSON body required");

        const current = await sbRest(
          ctx,
          `leave_requests?select=*&id=eq.${encodeURIComponent(params.id)}&limit=1`,
        );
        if (!current.ok) return fail(502, "upstream_error", "Unable to load leave request");
        const row = ((await current.json()) as Record<string, unknown>[])[0];
        if (!row) return fail(404, "not_found", "Leave request not found");

        const isStaff = hasAnyRole(ctx, STAFF);
        const isOwner = !!ctx.employeeId && row['employee_id'] === ctx.employeeId;
        if (!isStaff && !isOwner) return fail(403, "forbidden", "Not your leave request");

        const patch: Record<string, unknown> = {};

        if (body.attachments) {
          const cleaned = body.attachments
            .map((a) => keyFromRef(String(a)))
            .filter(Boolean)
            .slice(0, 10);
          const existing = Array.isArray(row['attachment_urls'])
            ? (row['attachment_urls'] as string[])
            : [];
          patch['attachment_urls'] = body.replaceAttachments
            ? cleaned
            : Array.from(new Set([...existing, ...cleaned])).slice(0, 10);
        }

        if (typeof body.reason === "string") {
          if (!isStaff && row['status'] !== "Pending")
            return fail(409, "conflict", "Approved requests can no longer be edited");
          patch['reason'] = body.reason.slice(0, 1000);
        }

        if (typeof body.remarks === "string") {
          if (!isStaff) return fail(403, "forbidden", "Only staff can set remarks");
          patch['remarks'] = body.remarks.slice(0, 1000);
        }

        if (body.status) {
          if (isStaff) {
            const allowed = ["Pending", "Approved", "Rejected", "Cancelled"];
            if (!allowed.includes(body.status))
              return fail(400, "bad_request", `status must be one of ${allowed.join(", ")}`);
            patch['status'] = body.status;
            if (body.status === "Approved" || body.status === "Rejected") {
              patch['approved_by'] = ctx.email ?? ctx.userId;
              patch['approved_at'] = new Date().toISOString();
            }
          } else {
            if (body.status !== "Cancelled")
              return fail(403, "forbidden", "You may only cancel your own request");
            if (row['status'] !== "Pending")
              return fail(409, "conflict", "Only pending requests can be cancelled");
            patch['status'] = "Cancelled";
          }
        }

        if (Object.keys(patch).length === 0)
          return fail(400, "bad_request", "Nothing to update");

        const res = await sbRest(ctx, `leave_requests?id=eq.${encodeURIComponent(params.id)}`, {
          method: "PATCH",
          prefer: "return=representation",
          body: JSON.stringify(patch),
        });
        if (!res.ok) return fail(502, "upstream_error", "Unable to update leave request");
        const saved = ((await res.json()) as Record<string, unknown>[])[0];
        return ok(saved ? fromLeave(saved) : null);
      },
    },
  },
});
