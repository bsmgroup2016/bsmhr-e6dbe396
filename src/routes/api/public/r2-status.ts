import { createFileRoute } from "@tanstack/react-router";
import { AwsClient } from "aws4fetch";
import { isAdmin, verifyUser, SCAN_FOLDERS } from "@/lib/r2.server";

type BucketDef = {
  id: "main" | "scans";
  title: string;
  purpose: string;
  folders: string;
  env: [string, string, string, string];
};

const BUCKETS: BucketDef[] = [
  {
    id: "main",
    title: "Main bucket",
    purpose: "All regular uploads: work permits, ICs, passports, certificates, employee documents, company logos, invoices and other attachments. Also holds older time cards / selfies uploaded before the second bucket was added.",
    folders: "Everything except " + SCAN_FOLDERS.join(", "),
    env: ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME"],
  },
  {
    id: "scans",
    title: "Scans bucket",
    purpose: "Scanned / uploaded time cards for OCR, and attendance selfies taken by workers at site.",
    folders: SCAN_FOLDERS.join(", "),
    env: ["R2_SCANS_ACCOUNT_ID", "R2_SCANS_ACCESS_KEY_ID", "R2_SCANS_SECRET_ACCESS_KEY", "R2_SCANS_BUCKET_NAME"],
  },
];

async function check(def: BucketDef, write: boolean) {
  const [a, k, s, b] = def.env.map((n) => process.env[n]);
  const base = { id: def.id, title: def.title, purpose: def.purpose, folders: def.folders, bucket: b ?? null };
  if (!a || !k || !s || !b) return { ...base, configured: false, reachable: false, message: "Not set up" };
  const client = new AwsClient({ accessKeyId: k, secretAccessKey: s, service: "s3", region: "auto" });
  const url = `https://${a}.r2.cloudflarestorage.com/${b}`;
  const t0 = Date.now();
  try {
    const res = await client.fetch(`${url}?list-type=2&max-keys=1000`);
    const ms = Date.now() - t0;
    if (!res.ok) return { ...base, configured: true, reachable: false, ms, message: `Cloudflare answered ${res.status}` };
    const xml = await res.text();
    const sizes = [...xml.matchAll(/<Size>(\d+)<\/Size>/g)].map((m) => Number(m[1]));
    const truncated = /<IsTruncated>true<\/IsTruncated>/.test(xml);
    let writeOk: boolean | null = null;
    if (write) {
      const key = `_health/test-${Date.now()}.txt`;
      const put = await client.fetch(`${url}/${key}`, { method: "PUT", body: "ok" });
      const get = put.ok ? await client.fetch(`${url}/${key}`) : null;
      await client.fetch(`${url}/${key}`, { method: "DELETE" });
      writeOk = !!(put.ok && get?.ok);
    }
    return {
      ...base, configured: true, reachable: true, ms,
      files: sizes.length, filesMore: truncated,
      bytes: sizes.reduce((x, y) => x + y, 0),
      writeOk,
      message: writeOk === false ? "Can read but cannot upload" : "Working",
    };
  } catch (e) {
    return { ...base, configured: true, reachable: false, message: e instanceof Error ? e.message : "Connection failed" };
  }
}

export const Route = createFileRoute("/api/public/r2-status")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const userId = await verifyUser(request);
        if (!userId) return new Response("Unauthorized", { status: 401 });
        if (!(await isAdmin(userId))) return new Response("Forbidden", { status: 403 });
        const write = new URL(request.url).searchParams.get("test") === "1";
        const buckets = await Promise.all(BUCKETS.map((d) => check(d, write)));
        const main = buckets[0];
        return Response.json(
          { configured: main.configured, reachable: main.reachable, buckets, checkedAt: new Date().toISOString() },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
});
