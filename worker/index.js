/**
 * BSM Workforce — Cloudflare R2 storage Worker
 *
 * Deploy: GitHub -> Cloudflare Workers, or `npx wrangler deploy` inside /worker.
 *
 * Bindings (wrangler.toml / Cloudflare dashboard):
 *   BUCKET        R2 bucket binding
 * Secrets (Worker -> Settings -> Variables):
 *   UPLOAD_TOKEN  shared secret the app sends as x-upload-token
 *   PUBLIC_BASE   public base URL of the bucket (custom domain or r2.dev)
 *   ALLOWED_ORIGIN  comma separated list of allowed app origins
 *
 * Routes:
 *   POST /upload       multipart form-data { file, folder } -> { url, key, size, contentType }
 *   POST /delete       json { key }
 *   GET  /file/<key>   streams the object (use when the bucket is private)
 */

const MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED_EXT = [
  "pdf", "jpg", "jpeg", "png", "webp", "heic",
  "doc", "docx", "xls", "xlsx", "csv", "txt",
];

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowed = (env.ALLOWED_ORIGIN || "").split(",").map((s) => s.trim()).filter(Boolean);
  const allowOrigin = allowed.length === 0 ? "*" : allowed.includes(origin) ? origin : allowed[0];
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-upload-token",
    "Access-Control-Max-Age": "86400",
  };
}

function json(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function authorized(request, env) {
  if (!env.UPLOAD_TOKEN) return false; // fail closed: token must be configured
  return request.headers.get("x-upload-token") === env.UPLOAD_TOKEN;
}

function safeName(name) {
  return name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(-80);
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    if (url.pathname === "/upload" && request.method === "POST") {
      if (!authorized(request, env)) return json({ error: "Unauthorized" }, 401, cors);

      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) return json({ error: "No file provided" }, 400, cors);
      if (file.size === 0 || file.size > MAX_BYTES) return json({ error: "Invalid file size" }, 400, cors);

      const ext = (file.name.split(".").pop() || "").toLowerCase();
      if (!ALLOWED_EXT.includes(ext)) return json({ error: "File type not allowed" }, 400, cors);

      const folderRaw = String(form.get("folder") || "documents");
      const folder = /^[a-z0-9/_-]{1,40}$/.test(folderRaw) ? folderRaw : "documents";

      const key = `${folder}/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${safeName(file.name)}`;
      await env.BUCKET.put(key, file.stream(), {
        httpMetadata: { contentType: file.type || "application/octet-stream" },
      });

      const base = (env.PUBLIC_BASE || `${url.origin}/file`).replace(/\/+$/, "");
      return json(
        { url: `${base}/${key}`, key, size: file.size, contentType: file.type || "application/octet-stream" },
        200,
        cors,
      );
    }

    if (url.pathname === "/delete" && request.method === "POST") {
      if (!authorized(request, env)) return json({ error: "Unauthorized" }, 401, cors);
      const body = await request.json().catch(() => null);
      const key = body && typeof body.key === "string" ? body.key : "";
      if (!key || key.includes("..")) return json({ error: "Invalid key" }, 400, cors);
      await env.BUCKET.delete(key);
      return json({ ok: true }, 200, cors);
    }

    if (url.pathname.startsWith("/file/") && request.method === "GET") {
      const key = decodeURIComponent(url.pathname.slice("/file/".length));
      if (!key || key.includes("..")) return json({ error: "Invalid key" }, 400, cors);
      const object = await env.BUCKET.get(key);
      if (!object) return json({ error: "Not found" }, 404, cors);
      const headers = new Headers(cors);
      object.writeHttpMetadata(headers);
      headers.set("etag", object.httpEtag);
      headers.set("Cache-Control", "private, max-age=300");
      return new Response(object.body, { headers });
    }

    return json({ error: "Not found" }, 404, cors);
  },
};
