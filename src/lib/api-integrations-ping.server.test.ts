import { afterEach, expect, test } from "bun:test";
import { pingProvider, type ActiveProvider } from "./api-integrations.server";

const originalFetch = globalThis.fetch;
const provider: ActiveProvider = { id: "test", name: "AI Brain", url: "https://example.com/v1/chat/completions", key: "private-test-key", model: "hr-brain", extra: {} };
afterEach(() => { globalThis.fetch = originalFetch; });

test("timeout returns actionable diagnostics and permits a fresh successful retry", async () => {
  let calls = 0;
  globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
    calls++;
    expect(JSON.parse(String(init?.body)).stream).toBe(false);
    if (calls === 1) throw new DOMException("deadline", "TimeoutError");
    return Response.json({ choices: [{ message: { content: "OK" } }], model: "hr-brain" });
  }) as typeof fetch;
  const failed = await pingProvider(provider);
  expect(failed).toMatchObject({ success: false, code: "timeout", retryable: true, model: "hr-brain" });
  expect(failed.error).toContain("20 seconds");
  expect(await pingProvider(provider)).toMatchObject({ success: true, error: null });
  expect(calls).toBe(2);
});

test("connection failures are not reported as timeouts", async () => {
  globalThis.fetch = (async () => { throw new TypeError("fetch failed"); }) as unknown as typeof fetch;
  expect(await pingProvider(provider)).toMatchObject({ success: false, code: "connection_error", retryable: true });
});

test("provider HTTP details do not expose echoed credentials", async () => {
  globalThis.fetch = (async () => new Response(provider.key, { status: 401 })) as unknown as typeof fetch;
  const result = await pingProvider(provider);
  expect(result).toMatchObject({ success: false, code: "access_denied", status: 401, retryable: false });
  expect(JSON.stringify(result)).not.toContain(provider.key);
});

test("unreadable successful responses have a distinct failure", async () => {
  globalThis.fetch = (async () => new Response("not JSON", { status: 200 })) as unknown as typeof fetch;
  expect(await pingProvider(provider)).toMatchObject({ success: false, code: "invalid_response" });
});