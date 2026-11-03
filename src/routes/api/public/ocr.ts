import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { canAccessKey, keyFromRef, verifyUser } from "@/lib/r2.server";

const fileSchema = z.object({
  kind: z.enum(["ipa", "timecard", "passport", "medical", "particular", "csoc"]),
  ref: z.string().min(1).max(2048),
});

const columnsSchema = z.object({
  kind: z.literal("columns"),
  headers: z.array(z.string().min(1).max(120)).min(1).max(80),
  fields: z.array(z.string().min(1).max(60)).min(1).max(120),
});

const bodySchema = z.union([fileSchema, columnsSchema]);

export const Route = createFileRoute("/api/public/ocr")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const userId = await verifyUser(request);
        if (!userId) return new Response("Unauthorized", { status: 401 });

        let parsed;
        try {
          parsed = bodySchema.parse(await request.json());
        } catch {
          return new Response("Invalid request", { status: 400 });
        }

        try {
          const ocr = await import("@/lib/ocr.server");

          if (parsed.kind === "columns") {
            return Response.json({ data: await ocr.mapColumns(parsed.headers, parsed.fields) });
          }

          // Only objects in our own R2 bucket may be read — never an arbitrary URL.
          const key = keyFromRef(parsed.ref);
          if (!key || /^https?:/i.test(key)) {
            return new Response("Invalid file reference", { status: 400 });
          }
          if (!(await canAccessKey(userId, key))) {
            return new Response("Not found", { status: 404 });
          }

          const data =
            parsed.kind === "ipa"
              ? await ocr.readIpa(key)
              : parsed.kind === "timecard"
                ? await ocr.readTimeCard(key)
                : parsed.kind === "passport"
                  ? await ocr.readPassport(key)
                  : parsed.kind === "particular"
                    ? await ocr.readParticular(key)
                    : parsed.kind === "csoc"
                      ? await ocr.readCsoc(key)
                      : await ocr.readMedicalBill(key);
          return Response.json({ data });
        } catch (e) {
          console.error("ocr failed", e);
          const message = e instanceof Error ? e.message : "OCR failed";
          return Response.json({ error: message }, { status: 502 });
        }
      },
    },
  },
});
