import { createFileRoute } from "@tanstack/react-router";
import {
  ALLOWED_EXT,
  r2Client,
  registerObject,
  ObjectMetadataError,
  uploadAllowance,
  uploadsToday,
  verifyUser,
} from "@/lib/r2.server";

export const Route = createFileRoute("/api/public/r2-upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const userId = await verifyUser(request);
        if (!userId) return new Response("Unauthorized", { status: 401 });

        let form: FormData;
        try {
          form = await request.formData();
        } catch {
          return new Response("Invalid form data", { status: 400 });
        }
        const file = form.get("file");
        const folder = String(form.get("folder") || "documents").replace(/[^a-z0-9_-]/gi, "");
        const employeeId = String(form.get("employeeId") || "").trim() || null;
        if (!(file instanceof File) || file.size === 0) {
          return new Response("No file provided", { status: 400 });
        }
        const allowance = await uploadAllowance(userId);
        if (file.size > allowance.maxBytes) {
          return new Response("File too large", { status: 413 });
        }
        if ((await uploadsToday(userId)) >= allowance.dailyLimit) {
          return new Response("Daily upload limit reached", { status: 429 });
        }

        const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
        if (!ALLOWED_EXT.includes(ext)) {
          return new Response("File type not allowed", { status: 415 });
        }
        const key = `${folder}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

        try {
          const { client, base } = r2Client(key);
          const put = await client.fetch(`${base}/${key}`, {
            method: "PUT",
            body: await file.arrayBuffer(),
            headers: { "Content-Type": file.type || "application/octet-stream" },
          });
          if (!put.ok) {
            return new Response(`R2 upload failed (${put.status})`, { status: 502 });
          }
          await registerObject({
            key,
            folder: folder || "documents",
            original_name: file.name,
            content_type: file.type || "application/octet-stream",
            size: file.size,
            employee_id: employeeId,
            uploaded_by: userId,
          });
        } catch (error) {
          if (error instanceof ObjectMetadataError) return new Response(error.message, { status: 502 });
          return new Response("R2 upload failed", { status: 500 });
        }

        return Response.json({
          key,
          url: `/api/public/r2-file?key=${encodeURIComponent(key)}`,
          size: file.size,
          contentType: file.type || "application/octet-stream",
          name: file.name,
        });
      },
    },
  },
});