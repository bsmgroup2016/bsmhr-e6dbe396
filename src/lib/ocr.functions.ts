import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const refSchema = z.object({ ref: z.string().min(1).max(2048) });

export const ocrIpa = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => refSchema.parse(data))
  .handler(async ({ data }) => {
    const { readIpa } = await import("@/lib/ocr.server");
    return readIpa(data.ref);
  });

export const ocrTimeCard = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => refSchema.parse(data))
  .handler(async ({ data }) => {
    const { readTimeCard } = await import("@/lib/ocr.server");
    return readTimeCard(data.ref);
  });