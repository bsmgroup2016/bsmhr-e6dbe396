import { postChat, type ActiveProvider } from "./api-integrations.server";

export type ChatCompletion = {
  model?: string;
  choices?: { message?: { content?: string | null; tool_calls?: { id: string; function: { name: string; arguments: string } }[] } }[];
};

/** Give the configured first provider a head start, then hedge slow requests.
 * Only a complete, usable answer wins; cancel all losing requests immediately.
 * No settings or keys are changed and every candidate gets the same conversation.
 */
export async function chatbotCompletion(
  providers: ActiveProvider[],
  body: Record<string, unknown>,
  options: { staggerMs?: number; timeoutMs?: number; send?: typeof postChat } = {},
) {
  if (!providers.length) throw new Error("No chatbot provider is configured.");
  const controller = new AbortController();
  const send = options.send ?? postChat;
  const staggerMs = options.staggerMs ?? 1000;
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 20_000);
  const tasks = providers.map(async (provider, index) => {
    if (index) await new Promise<void>((resolve, reject) => {
      const cancel = () => { clearTimeout(timer); reject(new Error("Request cancelled")); };
      const timer = setTimeout(() => {
        controller.signal.removeEventListener("abort", cancel);
        resolve();
      }, index * staggerMs);
      controller.signal.addEventListener("abort", cancel, { once: true });
      if (controller.signal.aborted) cancel();
    });
    const response = await send(provider, body, { signal: controller.signal });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`${provider.name}: HTTP ${response.status}`);
    }
    const completion = await response.json() as ChatCompletion;
    const message = completion.choices?.[0]?.message;
    if (!message?.content?.trim() && !message?.tool_calls?.length) throw new Error(`${provider.name}: empty reply`);
    return { completion, provider };
  });
  try {
    return await Promise.any(tasks);
  } catch {
    throw new Error("All chatbot providers are unavailable or took too long. Please try again shortly.");
  } finally {
    clearTimeout(timeout);
    controller.abort();
  }
}