/**
 * Shared API v1 server helpers.
 *
 * Every endpoint under `src/routes/api/public/v1/*` is a client-agnostic
 * HTTP contract: the React web app, the future Flutter Android/iOS apps and
 * any third-party client all speak to the same routes with the same
 * Supabase access token.
 *
 * Auth model: the caller sends `Authorization: Bearer <supabase access token>`.
 * We forward that token to Supabase REST so Row Level Security applies as
 * the signed-in user. No service-role key is ever used here.
 */

const SUPABASE_URL = "https://thrfyeyqafmdnpexgmlc.supabase.co";
const SUPABASE_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRocmZ5ZXlxYWZtZG5wZXhnbWxjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyNTMzNTcsImV4cCI6MjEwMDgyOTM1N30.4EGhaZVMSZYI2NPo6mdzBLgKbZJjlVqJ-cdm7VqDvrQ";

export const API_VERSION = "1.0.0";

/** CORS: native apps send no Origin, but web/other hosts do. */
export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "authorization,content-type,x-client-platform",
  "Access-Control-Max-Age": "86400",
};

export function preflight() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export function ok<T>(data: T, meta?: Record<string, unknown>) {
  return Response.json(
    { ok: true, data, ...(meta ? { meta } : {}) },
    { headers: { ...corsHeaders, "Cache-Control": "no-store" } },
  );
}

export function fail(status: number, code: string, message: string) {
  return Response.json(
    { ok: false, error: { code, message } },
    { status, headers: { ...corsHeaders, "Cache-Control": "no-store" } },
  );
}

/* ------------------------------------------------------------------ *
 * Rate limiting
 *
 * The server runtime is stateless, so counters live in Postgres
 * (`public.api_rate_limit` security-definer function, fixed window).
 * Defaults are generous for normal app usage but stop runaway loops or
 * mass requests from a single device/user.
 * ------------------------------------------------------------------ */

export type RateLimitRule = { limit: number; windowSeconds: number };

/** Per-endpoint budgets. Key = route bucket name. */
export const RATE_LIMITS: Record<string, RateLimitRule> = {
  default: { limit: 120, windowSeconds: 60 },
  auth: { limit: 600, windowSeconds: 60 }, // per-IP; carrier NAT shares IPs, so kept high
  dashboard: { limit: 60, windowSeconds: 60 },
  attendance: { limit: 60, windowSeconds: 60 },
  "attendance.sync": { limit: 20, windowSeconds: 60 },
  uploads: { limit: 20, windowSeconds: 60 },
  "driver.pings": { limit: 240, windowSeconds: 60 },
  payslip: { limit: 30, windowSeconds: 60 },
  notifications: { limit: 120, windowSeconds: 60 },
  devices: { limit: 30, windowSeconds: 60 },
};

function clientIp(request: Request) {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

type RateVerdict = { allowed: boolean; remaining: number; resetAt: string; limit: number };

async function consume(bucket: string, rule: RateLimitRule): Promise<RateVerdict> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/api_rate_limit`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON,
        Authorization: `Bearer ${SUPABASE_ANON}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        _bucket: bucket,
        _limit: rule.limit,
        _window_seconds: rule.windowSeconds,
      }),
    });
    if (!res.ok) throw new Error(`rpc ${res.status}`);
    const rows = (await res.json()) as Array<{
      allowed: boolean;
      remaining: number;
      reset_at: string;
    }>;
    const row = rows[0];
    if (!row) throw new Error("empty rpc result");
    return {
      allowed: row.allowed,
      remaining: row.remaining,
      resetAt: row.reset_at,
      limit: rule.limit,
    };
  } catch {
    // Fail open: a limiter outage must never take the API down.
    return {
      allowed: true,
      remaining: rule.limit,
      resetAt: new Date(Date.now() + rule.windowSeconds * 1000).toISOString(),
      limit: rule.limit,
    };
  }
}

export function rateHeaders(v: RateVerdict): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(v.limit),
    "X-RateLimit-Remaining": String(v.remaining),
    "X-RateLimit-Reset": v.resetAt,
  };
}

/**
 * Enforce a rate limit for this request. Identity = user id when known,
 * otherwise the client IP. Returns a ready-to-send 429 when exceeded.
 */
export async function enforceRateLimit(
  request: Request,
  bucketName: string,
  identity?: string,
): Promise<{ response?: Response; headers: Record<string, string> }> {
  const rule = RATE_LIMITS[bucketName] ?? RATE_LIMITS["default"]!;
  const who = identity ?? `ip:${clientIp(request)}`;
  const verdict = await consume(`${bucketName}|${who}`, rule);
  const headers = rateHeaders(verdict);
  if (verdict.allowed) return { headers };
  return {
    headers,
    response: Response.json(
      {
        ok: false,
        error: {
          code: "rate_limited",
          message: "Too many requests. Please slow down and try again shortly.",
        },
      },
      {
        status: 429,
        headers: {
          ...corsHeaders,
          ...headers,
          "Cache-Control": "no-store",
          "Retry-After": String(rule.windowSeconds),
        },
      },
    ),
  };
}

export type AuthContext = {
  userId: string;
  email: string | null;
  token: string;
  roles: string[];
  /** Employee row id linked to this account, when the caller is a worker. */
  employeeId: string | null;
};

/** Supabase REST call executed AS THE CALLER (RLS enforced). */
export async function sbRest(
  ctx: Pick<AuthContext, "token">,
  path: string,
  init?: RequestInit & { prefer?: string },
): Promise<Response> {
  const headers: Record<string, string> = {
    apikey: SUPABASE_ANON,
    Authorization: `Bearer ${ctx.token}`,
    "Content-Type": "application/json",
  };
  if (init?.prefer) headers["Prefer"] = init.prefer;
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers });
}

export async function sbSelect<T = Record<string, unknown>>(
  ctx: Pick<AuthContext, "token">,
  path: string,
): Promise<T[]> {
  const res = await sbRest(ctx, path);
  if (!res.ok) return [];
  return (await res.json()) as T[];
}

/** Validate the bearer token with Supabase Auth and load roles. */
export async function authenticate(request: Request): Promise<AuthContext | null> {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  if (!token) return null;

  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const user = (await res.json()) as { id?: string; email?: string };
  if (!user?.id) return null;

  const base = { userId: user.id, email: user.email ?? null, token };
  const [roleRows, empRows] = await Promise.all([
    sbSelect<{ role: string }>(base, `user_roles?select=role&user_id=eq.${user.id}`),
    sbSelect<{ id: string }>(base, `employees?select=id&user_id=eq.${user.id}&limit=1`),
  ]);

  return {
    ...base,
    roles: roleRows.map((r) => r.role),
    employeeId: empRows[0]?.id ?? null,
  };
}

/** Guard helper: returns a context or a ready-to-return 401 response. */
export async function requireAuth(
  request: Request,
  bucketName = "default",
): Promise<{ ctx: AuthContext } | { response: Response }> {
  // Pre-auth guard on the caller IP: stops token-guessing floods before we
  // spend a Supabase Auth round-trip.
  const ipGuard = await enforceRateLimit(request, "auth");
  if (ipGuard.response) return { response: ipGuard.response };

  const ctx = await authenticate(request);
  if (!ctx) return { response: fail(401, "unauthorized", "Valid access token required") };

  // Per-user guard on the specific endpoint budget.
  const userGuard = await enforceRateLimit(request, bucketName, `user:${ctx.userId}`);
  if (userGuard.response) return { response: userGuard.response };

  return { ctx };
}

export function hasAnyRole(ctx: AuthContext, roles: string[]) {
  return ctx.roles.some((r) => roles.includes(r));
}

export function requireRole(ctx: AuthContext, roles: string[]): Response | null {
  if (hasAnyRole(ctx, roles)) return null;
  return fail(403, "forbidden", "You do not have permission for this resource");
}

/** Standard list query params shared by every collection endpoint. */
export function listParams(request: Request) {
  const url = new URL(request.url);
  const limitRaw = Number(url.searchParams.get("limit") ?? 50);
  const offsetRaw = Number(url.searchParams.get("offset") ?? 0);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 50;
  const offset = Number.isFinite(offsetRaw) && offsetRaw > 0 ? Math.floor(offsetRaw) : 0;
  return {
    url,
    limit,
    offset,
    search: (url.searchParams.get("search") ?? "").trim(),
    companyId: url.searchParams.get("companyId") ?? "",
    status: url.searchParams.get("status") ?? "",
    from: url.searchParams.get("from") ?? "",
    to: url.searchParams.get("to") ?? "",
  };
}

export function pgLike(value: string) {
  return encodeURIComponent(`*${value.replace(/[*,()]/g, "")}*`);
}

export async function readJson<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}