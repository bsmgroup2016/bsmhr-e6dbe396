import { describe, expect, test } from "bun:test";
import { chatbotCompletion } from "./chatbot-provider.server";
import type { ActiveProvider, postChat } from "./api-integrations.server";

const providers: ActiveProvider[] = ["Gemini #1", "Gemini #2", "Groq", "OpenRouter"].map((name, index) => ({
  id: String(index), name, model: "fixture-model", key: "fixture-only", url: "https://example.invalid", extra: {},
}));
const answer = () => Response.json({ choices: [{ message: { content: "OK" } }] });
const pending = (signal?: AbortSignal) => new Promise<Response>((_resolve, reject) => {
  const cancel = () => reject(new Error("Aborted"));
  signal?.addEventListener("abort", cancel, { once: true });
  if (signal?.aborted) cancel();
});

describe("chatbot latency and safe fallback", () => {
  test("a fast first provider wins without starting other requests", async () => {
    const calls: string[] = [];
    const send: typeof postChat = async (p) => { calls.push(p.name); return answer(); };
    const result = await chatbotCompletion(providers, {}, { send, staggerMs: 10 });
    expect(result.provider.name).toBe("Gemini #1");
    expect(calls).toEqual(["Gemini #1"]);
  });
  test("slow Gemini requests do not block fast Groq and losers are aborted", async () => {
    const aborted: string[] = [];
    const send: typeof postChat = async (p, _body, options) => {
      if (p.name === "Groq") return answer();
      options?.signal?.addEventListener("abort", () => aborted.push(p.name), { once: true });
      return pending(options?.signal);
    };
    const original = providers.map(p => p.id);
    const result = await chatbotCompletion(providers, {}, { send, staggerMs: 5 });
    expect(result.provider.name).toBe("Groq");
    expect(aborted).toEqual(["Gemini #1", "Gemini #2"]);
    expect(providers.map(p => p.id)).toEqual(original);
  });
  test("failed or empty replies cannot win and fallback retains tool context", async () => {
    const bodies: Record<string, unknown>[] = [];
    const body = { messages: [{ role: "tool", tool_call_id: "read-1", content: '{"count":12}' }] };
    const send: typeof postChat = async (p, input) => {
      bodies.push(input);
      if (p.name === "Gemini #1") return new Response(null, { status: 429 });
      if (p.name === "Gemini #2") return Response.json({ choices: [{ message: { content: "" } }] });
      return answer();
    };
    const result = await chatbotCompletion(providers, body, { send, staggerMs: 1 });
    expect(result.provider.name).toBe("Groq");
    expect(bodies).toEqual([body, body, body]);
  });
  test("tool calls are usable responses even without text", async () => {
    const send: typeof postChat = async () => Response.json({ choices: [{ message: {
      content: null, tool_calls: [{ id: "count-1", function: { name: "count_rows", arguments: '{"table":"employees"}' } }],
    } }] });
    const result = await chatbotCompletion(providers, {}, { send });
    expect(result.completion.choices?.[0]?.message?.tool_calls?.[0]?.function.name).toBe("count_rows");
  });
  test("all stalled requests stop at the deadline", async () => {
    const send: typeof postChat = async (_p, _body, options) => pending(options?.signal);
    await expect(chatbotCompletion(providers, {}, { send, timeoutMs: 15, staggerMs: 1 })).rejects.toThrow("took too long");
  });
  test("a response must finish parsing before it wins", async () => {
    const send: typeof postChat = async (p, _body, options) => {
      if (p.name !== "Gemini #1") return answer();
      const stream = new ReadableStream({ start(controller) {
        options?.signal?.addEventListener("abort", () => controller.error(new Error("Aborted")), { once: true });
      } });
      return new Response(stream, { headers: { "Content-Type": "application/json" } });
    };
    const result = await chatbotCompletion(providers, {}, { send, staggerMs: 1 });
    expect(result.provider.name).toBe("Gemini #2");
  });
});