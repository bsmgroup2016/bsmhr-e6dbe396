import { createFileRoute } from "@tanstack/react-router";
import {
  ALLOWED_EXT,
  canAccessKey,
  keyFromRef,
  presignGet,
  r2Client,
  registerObject,
  uploadAllowance,
  uploadsToday,
} from "@/lib/r2.server";
import { fail, ok, preflight, requireAuth } from "@/lib/api-v1.server";

const FOLDERS = [
  "documents",
  "medical",
  "leave",
  "claims",
  "attendance",
  "safety",
  "profile",
];

/**
 * Mobile-friendly file upload wrapper.
 *
 * POST multipart/form-data  -> upload a file (MC photo, receipt, selfie proof)
 * GET  ?key=...             -> short-lived signed download link for the object
 */
export const Route = createFileRoute("/api/public/v1/uploads")({
  server: {
    handlers: {
      OPTIONS: preflight,

      GET: async ({ request }) => {
        const auth = await requireAuth(request, "uploads");
        if ("response" in auth) return auth.response;
        const key = keyFromRef(new URL(request.url).searchParams.get("key") ?? "");
        if (!key) return fail(400, "bad_request", "key is required");
        if (!(await canAccessKey(auth.ctx.userId, key)))
          return fail(404, "not_found", "File not found");
        try {
          const url = await presignGet(key, 300);
          return ok({ key, url, expiresIn: 300 });
        } catch {
          return fail(500, "storage_error", "Unable to create download link");
        }
      },

      POST: async ({ request }) => {
        const auth = await requireAuth(request, "uploads");
        if ("response" in auth) return auth.response;
        const { ctx } = auth;

        let form: FormData;
        try {
          form = await request.formData();
        } catch {
          return fail(400, "bad_request", "multipart/form-data body required");
        }

        const file = form.get("file");
        if (!(file instanceof File) || file.size === 0)
          return fail(400, "bad_request", "file field is required");

        const requested = String(form.get("folder") ?? "documents")
          .toLowerCase()
          .replace(/[^a-z0-9_-]/g, "");
        const folder = FOLDERS.includes(requested) ? requested : "documents";

        // Workers may only attach files to their own record.
        const requestedEmployee = String(form.get("employeeId") ?? "").trim();
        const isStaff = ctx.roles.some((r) =>
          ["admin", "hr", "manager", "supervisor"].includes(r),
        );
        const employeeId =
          (isStaff ? requestedEmployee : ctx.employeeId) || ctx.employeeId || null;

        const allowance = await uploadAllowance(ctx.userId);
        if (file.size > allowance.maxBytes)
          return fail(413, "file_too_large", `Maximum file size is ${Math.round(allowance.maxBytes / 1048576)} MB`);
        if ((await uploadsToday(ctx.userId)) >= allowance.dailyLimit)
          return fail(429, "rate_limited", "Daily upload limit reached");

        const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
        if (!ALLOWED_EXT.includes(ext))
          return fail(415, "unsupported_type", "File type not allowed");

        const key = `${folder}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
        const contentType = file.type || "application/octet-stream";

        try {
          const { client, base } = r2Client();
          const put = await client.fetch(`${base}/${key}`, {
            method: "PUT",
            body: await file.arrayBuffer(),
            headers: { "Content-Type": contentType },
          });
          if (!put.ok) return fail(502, "storage_error", "Upload to storage failed");
          await registerObject({
            key,
            folder,
            original_name: file.name,
            content_type: contentType,
            size: file.size,
            employee_id: employeeId,
            uploaded_by: ctx.userId,
          });
        } catch {
          return fail(500, "storage_error", "Upload failed");
        }

        return ok({
          key,
          url: `/api/public/r2-file?key=${encodeURIComponent(key)}`,
          name: file.name,
          size: file.size,
          contentType,
          folder,
        });
      },
    },
  },
});
