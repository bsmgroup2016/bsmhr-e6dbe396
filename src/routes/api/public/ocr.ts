import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { canAccessKey, keyFromRef, verifyUser } from "@/lib/r2.server";

const bodySchema = z.object({
  kind: z.enum(["ipa", "timecard"]),
  ref: z.string().min(1).max(2048),
});

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

        // Only objects in our own R2 bucket may be read — never an arbitrary URL.
        const key = keyFromRef(parsed.ref);
        if (!key || /^https?:/i.test(key)) {
          return new Response("Invalid file reference", { status: 400 });
        }
        if (!(await canAccessKey(userId, key))) {
          return new Response("Not found", { status: 404 });
        }

        try {
          const { readIpa, readTimeCard } = await import("@/lib/ocr.server");
          const data = parsed.kind === "ipa" ? await readIpa(key) : await readTimeCard(key);
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