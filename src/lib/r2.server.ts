import { AwsClient } from "aws4fetch";

const SUPABASE_URL = "https://thrfyeyqafmdnpexgmlc.supabase.co";
const SUPABASE_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRocmZ5ZXlxYWZtZG5wZXhnbWxjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyNTMzNTcsImV4cCI6MjEwMDgyOTM1N30.4EGhaZVMSZYI2NPo6mdzBLgKbZJjlVqJ-cdm7VqDvrQ";

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

export function r2Client() {
  const { accountId, accessKeyId, secretAccessKey, bucket } = r2Env();
  const client = new AwsClient({
    accessKeyId,
    secretAccessKey,
    service: "s3",
    region: "auto",
  });
  const base = `https://${accountId}.r2.cloudflarestorage.com/${bucket}`;
  return { client, base };
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