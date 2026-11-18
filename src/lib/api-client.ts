/**
 * Thin typed client for `/api/public/v1/*`.
 *
 * The web app can use this instead of talking to Supabase directly, so the
 * Flutter app and the web app exercise exactly the same endpoints, the same
 * permission checks and the same response envelope.
 */
import { supabase } from "@/integrations/supabase/client";

export type ApiEnvelope<T> =
  | { ok: true; data: T; meta?: { total?: number; limit?: number; offset?: number; hasMore?: boolean } }
  | { ok: false; error: { code: string; message: string } };

export const API_BASE = "/api/public/v1";

/** Gateway failures may be HTML; never treat them as saved application data. */
export async function readApiResponse<T>(response: Response, method = "GET"): Promise<ApiEnvelope<T>> {
  const isMutation = ["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase());
  const failure: ApiEnvelope<T> = {
    ok: false,
    error: {
      code: response.status >= 500 ? "service_unavailable" : "invalid_response",
      message: response.status >= 500
        ? (isMutation
            ? "The server is temporarily unavailable. Your change could not be confirmed. Refresh to check the latest record before trying again."
            : "The server is temporarily unavailable. Could not load data. Please refresh and try again.")
        : "The server returned an unexpected response. Please refresh and try again.",
    },
  };
  try {
    const value: unknown = await response.json();
    if (!value || typeof value !== "object" || !("ok" in value)) return failure;
    if (value.ok === true && "data" in value) return response.ok ? value as ApiEnvelope<T> : failure;
    if (value.ok === false && "error" in value && value.error && typeof value.error === "object"
      && "code" in value.error && typeof value.error.code === "string"
      && "message" in value.error && typeof value.error.message === "string") return value as ApiEnvelope<T>;
    return failure;
  } catch {
    return failure;
  }
}

export async function accessToken(forceRefresh = false): Promise<string | null> {
  if (forceRefresh) {
    const { data } = await supabase.auth.refreshSession();
    return data.session?.access_token ?? null;
  }
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  // Refresh ahead of expiry so idle tabs don't send a stale token.
  if (session?.expires_at && session.expires_at * 1000 - Date.now() < 60_000) return accessToken(true);
  return session?.access_token ?? null;
}

/** fetch with the caller's token; on 401 refreshes the session once and retries. */
export async function authedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const send = (token: string | null) => fetch(url, { ...init, headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${token ?? ""}` } });
  const res = await send(await accessToken());
  if (res.status !== 401) return res;
  const fresh = await accessToken(true);
  return fresh ? send(fresh) : res;
}

export async function apiFetch<T>(
  path: string,
  init?: { method?: string; body?: unknown; query?: Record<string, string | number | undefined> },
): Promise<ApiEnvelope<T>> {
  const token = await accessToken();
  if (!token) return { ok: false, error: { code: "unauthorized", message: "Please sign in again" } };

  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(init?.query ?? {})) {
    if (v !== undefined && v !== "") qs.set(k, String(v));
  }
  const url = `${API_BASE}${path}${qs.toString() ? `?${qs}` : ""}`;

  try {
    const method = init?.method ?? "GET";
    const res = await authedFetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        "x-client-platform": "web",
      },
      body: init?.body ? JSON.stringify(init.body) : undefined,
    });
    const envelope = await readApiResponse<T>(res, method);
    if (res.ok && envelope.ok && init?.method && ["POST", "PATCH", "DELETE"].includes(init.method.toUpperCase()) && typeof window !== "undefined") {
      const table = path.startsWith("/attendance") ? "attendance" : path.startsWith("/employees") ? "employees" : path.startsWith("/leave") ? "leave_requests" : null;
      if (table) window.dispatchEvent(new CustomEvent("bsm:data-write", { detail: table }));
    }
    return envelope;
  } catch {
    return { ok: false, error: { code: "network_error", message: "Network unavailable" } };
  }
}

/** Convenience wrapper: returns data or throws with the API message. */
export async function apiData<T>(...args: Parameters<typeof apiFetch<T>>): Promise<T> {
  const res = await apiFetch<T>(...args);
  if (!res.ok) throw new Error(res.error.message);
  return res.data;
}