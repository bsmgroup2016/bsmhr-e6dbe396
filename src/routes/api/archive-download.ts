import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/archive-download")({ server: { handlers: {
  GET: async ({ request }) => {
    const a = await import("@/lib/archive.server");
    try {
      await a.requireArchiveAdmin(request);
      const url = new URL(request.url); return await a.archiveDownload(url.searchParams.get("key") ?? "", url.searchParams.get("readable") === "1");
    } catch (e) {
      const error = e instanceof Error ? e.message : "Download failed";
      return Response.json({ error }, { status: error === "Unauthorized" ? 401 : error === "Forbidden" ? 403 : 400, headers: { "Cache-Control": "no-store" } });
    }
  },
} } });