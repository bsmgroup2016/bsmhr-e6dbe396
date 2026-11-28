import { AwsClient } from "aws4fetch";

const SUPABASE_URL = "https://supabase.bsmengg.com";
const SUPABASE_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzk1ODUyMTUwLCJleHAiOjE5NTM1MzIxNTB9.oKHcsh1PF5fehDyqcQn7Ja9epYtV44TXHZdq-X28TLM";

export function r2Env() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error("R2 is not configured");
  }
  return { accountId, accessKeyId, secretAccessKey, bucket };
}

function makeClient(e: { accountId: string; accessKeyId: string; secretAccessKey: string; bucket: string }) {
  const client = new AwsClient({
    accessKeyId: e.accessKeyId,
    secretAccessKey: e.secretAccessKey,
    service: "s3",
    region: "auto",
  });
  return { client, base: `https://${e.accountId}.r2.cloudflarestorage.com/${e.bucket}` };
}

/** Folders stored in the secondary "scans" bucket (time cards + attendance selfies). */
export const SCAN_FOLDERS = ["time-cards", "attendance"];

export function isScanKey(key: string) {
  return SCAN_FOLDERS.includes(safeKey(key).split("/")[0]);
}

function scansEnv() {
  const accountId = process.env.R2_SCANS_ACCOUNT_ID;
  const accessKeyId = process.env.R2_SCANS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SCANS_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_SCANS_BUCKET_NAME;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) return null;
  return { accountId, accessKeyId, secretAccessKey, bucket };
}

/** Client for one specific bucket by id, regardless of key folder rules (admin media browser). */
export function r2BucketClient(id: "main" | "scans") {
  const env = id === "scans" ? scansEnv() : r2Env();
  if (!env) return null;
  return makeClient(env);
}

/** Client for writing `key`: scan folders go to the secondary bucket when configured. */
export function r2Client(key?: string) {
  const s = key && isScanKey(key) ? scansEnv() : null;
  return makeClient(s ?? r2Env());
}

/** Candidate buckets for reading `key` (scan bucket first, then main for older files). */
export function r2ReadClients(key: string) {
  const list = [] as ReturnType<typeof makeClient>[];
  const s = scansEnv();
  const main = makeClient(r2Env());
  if (s && isScanKey(key)) list.push(makeClient(s), main);
  else if (s) list.push(main, makeClient(s));
  else list.push(main);
  return list;
}

/** Fetch an object from whichever bucket holds it. */
export async function r2FetchObject(key: string, init?: RequestInit) {
  const clients = r2ReadClients(key);
  let last: Response | null = null;
  for (const { client, base } of clients) {
    last = await client.fetch(`${base}/${key}`, init);
    if (last.ok) return last;
  }
  return last!;
}

/** Verify the caller's Supabase access token. Returns the user id or null. */
export async function verifyUser(request: Request): Promise<string | null> {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_ANON, Authorization: auth },
  });
  if (!res.ok) return null;
  const user = (await res.json()) as { id?: string };
  return user?.id ?? null;
}

export function safeKey(key: string) {
  return key.replace(/^\/+/, "").replace(/\.\./g, "");
}

/* ---------------- access control ---------------- */

function serviceKey() {
  const key = process.env.SB_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Service key missing");
  return key;
}

async function restGet(path: string) {
  const key = serviceKey();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) return [] as any[];
  return (await res.json()) as any[];
}

const STAFF_ROLES = ["admin", "manager", "supervisor"];

export async function userRoles(userId: string): Promise<string[]> {
  const rows = await restGet(
    `user_roles?select=role&user_id=eq.${encodeURIComponent(userId)}`,
  );
  return rows.map((r) => String(r.role));
}

export async function isAdmin(userId: string) {
  return (await userRoles(userId)).includes("admin");
}

/**
 * Upload allowance. Users without any role (fresh sign-ups) get a small
 * per-file size cap and a daily upload count limit to prevent storage abuse.
 */
export async function uploadAllowance(userId: string) {
  const roles = await userRoles(userId);
  const privileged = roles.some((r) => STAFF_ROLES.includes(r) || r === "hr");
  if (privileged) return { maxBytes: 25 * 1024 * 1024, dailyLimit: 500 };
  if (roles.length > 0) return { maxBytes: 10 * 1024 * 1024, dailyLimit: 50 };
  return { maxBytes: 5 * 1024 * 1024, dailyLimit: 10 };
}

/** Number of objects the user uploaded in the last 24 hours. */
export async function uploadsToday(userId: string): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const rows = await restGet(
    `storage_objects?select=key&uploaded_by=eq.${encodeURIComponent(userId)}&created_at=gte.${since}`,
  );
  return rows.length;
}

/** A caller may read an object if they uploaded it or hold a staff role. */
export async function canAccessKey(userId: string, key: string) {
  const rows = await restGet(
    `storage_objects?select=uploaded_by&key=eq.${encodeURIComponent(key)}&limit=1`,
  );
  if (rows.length === 0) return false;
  if (rows[0].uploaded_by === userId) return true;
  return (await userRoles(userId)).some((r) => STAFF_ROLES.includes(r));
}

export class ObjectMetadataError extends Error {
  constructor() {
    super("File uploaded, but its metadata could not be saved. Upload was not completed; please retry or contact your administrator.");
    this.name = "ObjectMetadataError";
  }
}

export async function registerObject(row: {
  key: string;
  folder: string;
  original_name: string;
  content_type: string;
  size: number;
  employee_id: string | null;
  uploaded_by: string;
}) {
  const key = serviceKey();
  const response = await fetch(`${SUPABASE_URL}/rest/v1/storage_objects`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify(row),
  }).catch(() => { throw new ObjectMetadataError(); });
  if (!response.ok) throw new ObjectMetadataError();
}

export async function unregisterObject(objectKey: string) {
  const key = serviceKey();
  await fetch(
    `${SUPABASE_URL}/rest/v1/storage_objects?key=eq.${encodeURIComponent(objectKey)}`,
    { method: "DELETE", headers: { apikey: key, Authorization: `Bearer ${key}` } },
  );
}

export const ALLOWED_EXT = [
  "pdf", "jpg", "jpeg", "png", "webp", "gif", "heic",
  "doc", "docx", "xls", "xlsx", "csv", "txt",
];

/** Extract the object key from either a raw key or an /api/public/r2-file?key=... link. */
export function keyFromRef(ref: string): string {
  if (!ref) return "";
  if (ref.includes("r2-file")) {
    const q = ref.split("?")[1] ?? "";
    const k = new URLSearchParams(q).get("key") ?? "";
    return safeKey(k);
  }
  return safeKey(ref);
}

/** Create a short-lived presigned GET url for an object (default 5 minutes). */
export async function presignGet(key: string, expiresIn = 300): Promise<string> {
  const clients = r2ReadClients(key);
  let pick = clients[0];
  for (const c of clients) {
    const head = await c.client.fetch(`${c.base}/${key}`, { method: "HEAD" });
    if (head.ok) { pick = c; break; }
  }
  const { client, base } = pick;
  const signed = await client.sign(
    new Request(`${base}/${key}?X-Amz-Expires=${expiresIn}`),
    { aws: { signQuery: true } },
  );
  return signed.url;
}