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

async function accessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
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
    const res = await fetch(url, {
      method: init?.method ?? "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "x-client-platform": "web",
      },
      body: init?.body ? JSON.stringify(init.body) : undefined,
    });
    const envelope = (await res.json()) as ApiEnvelope<T>;
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