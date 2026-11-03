import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { ARCHIVE_TABLES } from "@/core/archive-policy";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("overview"), month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/) }),
  z.object({ action: z.literal("dry-run") }),
  z.object({ action: z.literal("start"), confirmed: z.literal(true) }),
  z.object({ action: z.literal("step") }),
  z.object({ action: z.literal("settings"), monthly: z.boolean().optional(), paused: z.boolean().optional() }),
  z.object({ action: z.literal("holds"), holds: z.array(z.object({ table: z.enum(ARCHIVE_TABLES), id: z.string().min(1).max(300), reason: z.string().min(1).max(200) })).max(2000) }),
]);
export const archiveAction = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
    const archive = await import("@/lib/archive.server");
    await archive.requireArchiveAdmin(getRequest());
    switch (data.action) {
      case "overview": return archive.archiveOverview(data.month);
      case "dry-run": return archive.archiveDryRun();
      case "start": return archive.startArchiveRun(data.confirmed);
      case "step": return archive.archiveStep();
      case "settings": return archive.archiveConfigure({ ...(data.monthly === undefined ? {} : { monthly: data.monthly }), ...(data.paused === undefined ? {} : { paused: data.paused }) });
      case "holds": return archive.archiveConfigure({}, data.holds);
    }
  });