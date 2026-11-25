import { HR_BRAIN_BASE_URL, hrBrainBody } from "@/core/hr-brain";

type Dependencies = {
  verifyUser: (request: Request) => Promise<string | null>;
  isAdmin: (userId: string) => Promise<boolean>;
  apiKey: () => string | undefined;
  baseUrl: () => string | undefined;
  fetch: typeof fetch;
};

const trustedOrigins = new Set([
  "https://hrbsm.xyz", "https://www.hrbsm.xyz", "https://bsmhr.lovable.app",
  "https://id-preview--8a11253f-28d2-4bb4-821d-07f8588d6127.lovable.app",
]);

export async function handleHrBrain(request: Request, deps: Dependencies): Promise<Response> {
  const origin = request.headers.get("Origin");
  const headers = new Headers({ "Cache-Control": "no-store", Vary: "Origin" });
  const json = (data: unknown, status: number) => Response.json(data, { status, headers });
  if (origin && origin !== new URL(request.url).origin && !trustedOrigins.has(origin)) {
    return json({ error: "Origin not allowed" }, 403);
  }
  if (origin) headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Access-Control-Allow-Headers", "authorization, content-type");
  headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (request.method !== "POST") return json({ error: "Use POST" }, 405);
  try {
    const userId = await deps.verifyUser(request);
    if (!userId) return json({ error: "Not signed in" }, 401);
    // Only staff roles (checked by the route) can spend this service's credits.
    if (!(await deps.isAdmin(userId))) return json({ error: "Staff only" }, 403);
    const apiKey = deps.apiKey();
    if (!apiKey) return json({ error: "AI Brain is not configured. Add HR_BRAIN_API_KEY in project secrets." }, 503);
    const raw = await request.text();
    if (raw.length > 1_000_000) return json({ error: "Request is too large" }, 413);
    let body: ReturnType<typeof hrBrainBody>;
    try { body = hrBrainBody(JSON.parse(raw)); }
    catch { return json({ error: "Invalid AI Brain request. Check messages and generation options." }, 400); }
    const baseUrl = (deps.baseUrl() || HR_BRAIN_BASE_URL).replace(/\/+$/, "");
    if (new URL(baseUrl).protocol !== "https:") return json({ error: "AI Brain base URL must use HTTPS" }, 503);
    // Worker fetch requires an unbound invocation, not deps.fetch() with deps as `this`.
    const fetchUpstream = deps.fetch;
    const upstream = await fetchUpstream(`${baseUrl}/chat/completions`, {
      method: "POST", redirect: "manual", signal: AbortSignal.any([request.signal, AbortSignal.timeout(120_000)]),
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
    });
    if (upstream.status !== 200) {
      await upstream.body?.cancel();
      const reasons: Record<number, string> = {
        401: "The provider rejected the configured API key.", 403: "The provider denied access.",
        429: "The provider's quota or rate limit was reached.",
      };
      return json({ error: `AI Brain provider returned HTTP ${upstream.status}. ${reasons[upstream.status] ?? "Check the provider service and configuration."}`, upstreamStatus: upstream.status }, 502);
    }
    const type = upstream.headers.get("Content-Type") ?? "";
    if (body.stream) {
      if (!type.includes("text/event-stream") || !upstream.body) {
        await upstream.body?.cancel();
        return json({ error: "AI Brain provider did not return an SSE stream." }, 502);
      }
      headers.set("Content-Type", "text/event-stream");
      headers.set("X-Accel-Buffering", "no");
      return new Response(upstream.body, { headers });
    }
    const result = await upstream.json().catch(() => null) as { error?: unknown; model?: unknown; choices?: unknown } | null;
    if (!result || result.error || typeof result.model !== "string" || !Array.isArray(result.choices) || !result.choices.length) {
      return json({ error: "AI Brain provider returned an invalid completion." }, 502);
    }
    return json(result, 200);
  } catch {
    return json({ error: "AI Brain could not complete the request. Check connectivity and try again." }, 502);
  }
}