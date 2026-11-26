import {
  interpretBrevoDeliveryEvents,
  type BrevoDeliveryEvent,
  type SmtpTestResult,
} from "@/core/smtp-delivery";

type DeliveryInput = { email: string; subject: string; sentAt: string };

type DeliveryDependencies = {
  fetcher?: (url: string, init: RequestInit) => Promise<Response>;
  wait?: (ms: number) => Promise<void>;
  attempts?: number;
};

/** SMTP acceptance is not delivery: inspect Brevo's asynchronous event report for this test. */
export async function confirmBrevoTestDelivery(
  apiKey: string,
  input: DeliveryInput,
  dependencies: DeliveryDependencies = {},
): Promise<SmtpTestResult> {
  const fetcher = dependencies.fetcher ?? fetch;
  const wait = dependencies.wait ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const attempts = dependencies.attempts ?? 4;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const query = new URLSearchParams({ email: input.email, limit: "20", offset: "0", sort: "desc" });
      const response = await fetcher(`https://api.brevo.com/v3/smtp/statistics/events?${query}`, {
        headers: { "api-key": apiKey, accept: "application/json" },
        signal: AbortSignal.timeout(8_000),
      });
      if (!response.ok) return { success: true, error: null, delivery: "accepted" };
      const data = await response.json() as { events?: BrevoDeliveryEvent[] };
      const result = interpretBrevoDeliveryEvents(data.events ?? [], input);
      if (!result.success || result.delivery === "delivered") return result;
    } catch {
      return { success: true, error: null, delivery: "accepted" };
    }
    if (attempt + 1 < attempts) await wait(1_500);
  }

  return { success: true, error: null, delivery: "accepted" };
}
