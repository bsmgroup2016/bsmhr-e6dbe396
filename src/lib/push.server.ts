import { assertAvailableTable } from "@/core/data-tables";
/**
 * Push notifications (Firebase Cloud Messaging HTTP v1).
 *
 * One code path serves Android (FCM) and iOS (FCM -> APNs), so the Flutter
 * apps only ever register an FCM token. Every push is also stored in
 * public.notifications so the in-app inbox works even if delivery fails.
 *
 * Secret: FCM_SERVICE_ACCOUNT_JSON (the Firebase service-account JSON).
 */
const SUPABASE_URL = "https://thrfyeyqafmdnpexgmlc.supabase.co";

function serviceKey() {
  const key = process.env["SB_SERVICE_ROLE_KEY"];
  if (!key) throw new Error("Service key missing");
  return key;
}

async function sbAdmin(path: string, init?: RequestInit & { prefer?: string }) {
  const key = serviceKey();
  const headers: Record<string, string> = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
  if (init?.prefer) headers["Prefer"] = init.prefer;
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers });
}

type ServiceAccount = { client_email: string; private_key: string; project_id: string };

function serviceAccount(): ServiceAccount | null {
  const raw = process.env["FCM_SERVICE_ACCOUNT_JSON"];
  if (!raw) return null;
  try {
    const sa = JSON.parse(raw) as ServiceAccount;
    if (!sa.client_email || !sa.private_key || !sa.project_id) return null;
    return sa;
  } catch {
    return null;
  }
}

export const pushConfigured = () => serviceAccount() !== null;

const b64url = (bytes: Uint8Array) => {
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const encodeJson = (obj: unknown) => b64url(new TextEncoder().encode(JSON.stringify(obj)));

function pemToPkcs8(pem: string): ArrayBuffer {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const raw = atob(body);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out.buffer;
}

let cachedToken: { value: string; expires: number } | null = null;

/** OAuth access token for FCM, cached until shortly before expiry. */
async function accessToken(sa: ServiceAccount): Promise<string | null> {
  if (cachedToken && cachedToken.expires > Date.now() + 60_000) return cachedToken.value;

  const now = Math.floor(Date.now() / 1000);
  const header = encodeJson({ alg: "RS256", typ: "JWT" });
  const claims = encodeJson({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  });
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToPkcs8(sa.private_key.replace(/\\n/g, "\n")),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(`${header}.${claims}`),
  );
  const jwt = `${header}.${claims}.${b64url(new Uint8Array(sig))}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) return null;
  cachedToken = {
    value: json.access_token,
    expires: Date.now() + (json.expires_in ?? 3600) * 1000,
  };
  return cachedToken.value;
}

export interface PushInput {
  /** auth.users ids to notify. */
  userIds: string[];
  title: string;
  body: string;
  category?: string;
  /** Small string map delivered to the app (deep-link route, record id, ...). */
  data?: Record<string, string>;
}

export interface PushResult {
  stored: number;
  sent: number;
  failed: number;
  configured: boolean;
}

/**
 * Store the notification for every recipient, then deliver to their devices.
 * Invalid tokens are disabled so we stop pushing to uninstalled apps.
 */
export async function sendPush(input: PushInput): Promise<PushResult> {
  assertAvailableTable("notifications");
  const userIds = [...new Set(input.userIds.filter(Boolean))];
  const result: PushResult = { stored: 0, sent: 0, failed: 0, configured: pushConfigured() };
  if (!userIds.length) return result;

  const rows = userIds.map((user_id) => ({
    user_id,
    title: input.title,
    body: input.body,
    category: input.category ?? "general",
    data: input.data ?? {},
  }));
  const stored = await sbAdmin("notifications", { method: "POST", body: JSON.stringify(rows) });
  if (stored.ok) result.stored = rows.length;

  const sa = serviceAccount();
  if (!sa) return result;
  const token = await accessToken(sa);
  if (!token) return result;

  const list = userIds.map((id) => `"${id}"`).join(",");
  const devRes = await sbAdmin(
    `device_tokens?select=id,token&enabled=is.true&user_id=in.(${encodeURIComponent(list)})`,
  );
  if (!devRes.ok) return result;
  const devices = (await devRes.json()) as { id: string; token: string }[];

  const dead: string[] = [];
  await Promise.all(
    devices.map(async (d) => {
      const res = await fetch(
        `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            message: {
              token: d.token,
              notification: { title: input.title, body: input.body },
              data: { category: input.category ?? "general", ...(input.data ?? {}) },
              android: { priority: "HIGH" },
              apns: { payload: { aps: { sound: "default" } } },
            },
          }),
        },
      );
      if (res.ok) {
        result.sent += 1;
        return;
      }
      result.failed += 1;
      if (res.status === 404 || res.status === 400) dead.push(d.id);
    }),
  );

  if (dead.length) {
    await sbAdmin(
      `device_tokens?id=in.(${encodeURIComponent(dead.map((i) => `"${i}"`).join(","))})`,
      {
        method: "PATCH",
        prefer: "return=minimal",
        body: JSON.stringify({ enabled: false }),
      },
    );
  }

  if (result.sent) {
    await sbAdmin(`notifications?user_id=in.(${encodeURIComponent(list)})&delivered=is.false`, {
      method: "PATCH",
      prefer: "return=minimal",
      body: JSON.stringify({ delivered: true }),
    });
  }
  return result;
}

/** Look up the auth user ids linked to employee rows. */
export async function userIdsForEmployees(employeeIds: string[]): Promise<string[]> {
  const ids = employeeIds.filter(Boolean);
  if (!ids.length) return [];
  const res = await sbAdmin(
    `employees?select=user_id&id=in.(${encodeURIComponent(ids.map((i) => `"${i}"`).join(","))})`,
  );
  if (!res.ok) return [];
  const rows = (await res.json()) as { user_id: string | null }[];
  return rows.map((r) => r.user_id).filter((v): v is string => Boolean(v));
}
