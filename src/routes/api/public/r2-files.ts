import { createFileRoute } from "@tanstack/react-router";
import { isAdmin, verifyUser, r2BucketClient, safeKey } from "@/lib/r2.server";

const BUCKET_META = {
  main: { title: "Main bucket", purpose: "Work permits, ICs, passports, certificates, employee documents, logos, invoices and other attachments." },
  scans: { title: "Scans bucket", purpose: "Time-card scans for OCR and attendance selfies." },
} as const;

type BucketId = keyof typeof BUCKET_META;

function bucketId(raw: string | null): BucketId | null {
  return raw === "main" || raw === "scans" ? raw : null;
}

function text(tag: string, xml: string): string[] {
  return [...xml.matchAll(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "g"))].map((m) => m[1]);
}

function decodeXml(s: string) {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

async function presign(client: ReturnType<typeof r2BucketClient>, key: string, expiresIn = 300) {
  if (!client) return null;
  const signed = await client.client.sign(
    new Request(`${client.base}/${key}?X-Amz-Expires=${expiresIn}`),
    { aws: { signQuery: true } },
  );
  return signed.url;
}

export const Route = createFileRoute("/api/public/r2-files")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const userId = await verifyUser(request);
        if (!userId) return new Response("Unauthorized", { status: 401 });
        if (!(await isAdmin(userId))) return new Response("Forbidden", { status: 403 });

        const url = new URL(request.url);
        const id = bucketId(url.searchParams.get("bucket"));
        if (!id) return Response.json({ error: "Unknown bucket" }, { status: 400 });
        const client = r2BucketClient(id);
        if (!client) return Response.json({ error: "Bucket is not configured" }, { status: 503 });

        // View mode: return a short-lived presigned URL for one object.
        const view = url.searchParams.get("view");
        if (view) {
          const key = safeKey(view);
          const head = await client.client.fetch(`${client.base}/${key}`, { method: "HEAD" });
          if (!head.ok) return Response.json({ error: "File not found" }, { status: 404 });
          const viewUrl = await presign(client, key);
          return Response.json(
            { url: viewUrl, contentType: head.headers.get("content-type") ?? "application/octet-stream" },
            { headers: { "Cache-Control": "no-store" } },
          );
        }

        // List mode: folder-style listing with delimiter.
        const prefix = safeKey(url.searchParams.get("prefix") ?? "");
        const cursor = url.searchParams.get("cursor") ?? "";
        const params = new URLSearchParams({
          "list-type": "2",
          delimiter: "/",
          "max-keys": "200",
          prefix,
        });
        if (cursor) params.set("continuation-token", cursor);

        const res = await client.client.fetch(`${client.base}?${params}`);
        if (!res.ok) {
          return Response.json({ error: `Cloudflare answered ${res.status}` }, { status: 502 });
        }
        const xml = await res.text();

        const folders = text("Prefix", xml)
          .map(decodeXml)
          .filter((p) => p !== prefix);
        const contents = [...xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)].map((m) => {
          const block = m[1];
          const key = decodeXml(text("Key", block)[0] ?? "");
          const size = Number(text("Size", block)[0] ?? 0);
          const lastModified = text("LastModified", block)[0] ?? "";
          return { key, name: key.slice(prefix.length), size, lastModified };
        }).filter((f) => f.key && f.key !== prefix);

        const next = text("NextContinuationToken", xml)[0];
        return Response.json(
          {
            bucket: { id, ...BUCKET_META[id] },
            prefix,
            folders,
            files: contents,
            nextCursor: next ? decodeXml(next) : null,
          },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
});
