import { describe, expect, test } from "bun:test";
import { hrBrainBody } from "./hr-brain";
import { handleHrBrain } from "../lib/hr-brain.server";

describe("AI Brain request contract", () => {
  const messages = [{ role: "user", content: "Say OK" }];
  test("always uses hr-brain even if a caller supplies another model", () => {
    expect(hrBrainBody({ messages, model: "other" }).model).toBe("hr-brain");
  });
  test("defaults to 2048 tokens and non-streaming", () => {
    expect(hrBrainBody({ messages })).toMatchObject({ max_tokens: 2048, stream: false });
  });
  test("tiny positive token budgets are raised to 1024", () => {
    expect(hrBrainBody({ messages, max_tokens: 16 }).max_tokens).toBe(1024);
    expect(hrBrainBody({ messages, max_tokens: 50 }).max_tokens).toBe(1024);
  });
  test("prepends system prompt and preserves tool messages, tools and temperature", () => {
    const tools = [{ type: "function" as const, function: { name: "lookup", parameters: { type: "object" } } }];
    const body = hrBrainBody({ messages, systemPrompt: "System", temperature: 0.2, tools });
    expect(body.messages).toEqual([{ role: "system", content: "System" }, ...messages]);
    expect(body.tools).toEqual(tools);
    expect(body.temperature).toBe(0.2);
  });
  test("rejects empty messages and invalid options", () => {
    expect(() => hrBrainBody({ messages: [] })).toThrow();
    expect(() => hrBrainBody({ messages, temperature: 4 })).toThrow();
    expect(() => hrBrainBody({ messages, max_tokens: -1 })).toThrow();
  });
});

describe("AI Brain authenticated forwarding", () => {
  function setup(options: { signedIn?: boolean; admin?: boolean; upstream?: Response } = {}) {
    let forwarded: { url: string; init?: RequestInit } | null = null;
    const deps = {
      verifyUser: async () => options.signedIn === false ? null : "test-user",
      isAdmin: async () => options.admin !== false,
      apiKey: (): string | undefined => "fixture-only-credential",
      baseUrl: () => undefined,
      fetch: (async (url: string | URL | Request, init?: RequestInit) => {
        forwarded = { url: String(url), ...(init ? { init } : {}) };
        return options.upstream ?? Response.json({ model: "hr-brain", choices: [{ message: { content: "OK" } }] });
      }) as typeof fetch,
    };
    return { deps, forwarded: () => forwarded };
  }
  const request = (stream = false) => new Request("https://hrbsm.xyz/api/public/hr-brain", {
    method: "POST", body: JSON.stringify({ messages: [{ role: "user", content: "Say OK" }], stream }),
  });
  test("signed-out requests never reach the provider", async () => {
    const s = setup({ signedIn: false });
    expect((await handleHrBrain(request(), s.deps)).status).toBe(401);
    expect(s.forwarded()).toBeNull();
  });
  test("non-admin requests never reach the provider", async () => {
    const s = setup({ admin: false });
    expect((await handleHrBrain(request(), s.deps)).status).toBe(403);
    expect(s.forwarded()).toBeNull();
  });
  test("forwards the exact endpoint and standard request with defaults", async () => {
    const s = setup();
    const response = await handleHrBrain(request(), s.deps);
    expect(await response.json()).toMatchObject({ model: "hr-brain" });
    const call = s.forwarded();
    expect(call?.url).toBe("https://hr.seobdshop.com/v1/chat/completions");
    expect(JSON.parse(String(call?.init?.body))).toMatchObject({ model: "hr-brain", max_tokens: 2048, stream: false });
    expect(new Headers(call?.init?.headers).get("Authorization")).toBe("Bearer fixture-only-credential");
  });
  test("SSE bytes pass through without JSON wrapping", async () => {
    const bytes = 'data: {"choices":[{"delta":{"content":"OK"}}]}\n\ndata: [DONE]\n\n';
    const s = setup({ upstream: new Response(bytes, { headers: { "Content-Type": "text/event-stream" } }) });
    const response = await handleHrBrain(request(true), s.deps);
    expect(response.headers.get("Content-Type")).toBe("text/event-stream");
    expect(await response.text()).toBe(bytes);
  });
  test("calls Worker fetch unbound to avoid Illegal invocation", async () => {
    const s = setup();
    let invoked = false;
    s.deps.fetch = (async function (this: unknown, _input: string | URL | Request, _init?: RequestInit) {
      if (this !== undefined) throw new TypeError("Illegal invocation");
      invoked = true;
      return Response.json({ model: "hr-brain", choices: [{ message: { content: "OK" } }] });
    }) as typeof fetch;
    const response = await handleHrBrain(request(), s.deps);
    expect(response.status).toBe(200);
    expect(invoked).toBe(true);
  });
  test("non-200 provider errors surface status without reflecting provider secrets", async () => {
    const s = setup({ upstream: new Response("fixture-only-credential", { status: 401 }) });
    const response = await handleHrBrain(request(), s.deps);
    expect(response.status).toBe(502);
    const text = await response.text();
    expect(text).toContain("401");
    expect(text).not.toContain("fixture-only-credential");
  });
  test("missing secret returns configuration error without forwarding", async () => {
    const s = setup(); s.deps.apiKey = () => undefined;
    expect((await handleHrBrain(request(), s.deps)).status).toBe(503);
    expect(s.forwarded()).toBeNull();
  });
  test("preflight permits known origins without authentication", async () => {
    const s = setup({ signedIn: false });
    const response = await handleHrBrain(new Request("https://hrbsm.xyz/api/public/hr-brain", {
      method: "OPTIONS", headers: { Origin: "https://www.hrbsm.xyz" },
    }), s.deps);
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://www.hrbsm.xyz");
    expect(s.forwarded()).toBeNull();
  });
  test("untrusted origins are blocked", async () => {
    const s = setup();
    expect((await handleHrBrain(new Request("https://hrbsm.xyz/api/public/hr-brain", {
      method: "OPTIONS", headers: { Origin: "https://untrusted.example" },
    }), s.deps)).status).toBe(403);
  });
});