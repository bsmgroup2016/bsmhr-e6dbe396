export type SmtpDeliveryState = "delivered" | "accepted";

export type SmtpTestResult = {
  success: boolean;
  error: string | null;
  delivery: SmtpDeliveryState;
};

export type BrevoDeliveryEvent = {
  email?: string;
  subject?: string;
  event?: string;
  date?: string;
  reason?: string;
};

/** Interpret only events belonging to this test, never an earlier test with the same subject. */
export function interpretBrevoDeliveryEvents(
  events: BrevoDeliveryEvent[],
  input: { email: string; subject: string; sentAt: string },
): SmtpTestResult {
  const sentTime = new Date(input.sentAt).getTime();
  const matching = events.filter((event) => {
    const eventTime = event.date ? new Date(event.date).getTime() : Number.NaN;
    return event.email?.toLowerCase() === input.email.toLowerCase()
      && event.subject === input.subject
      && Number.isFinite(eventTime)
      && eventTime >= sentTime;
  });

  const failed = matching.find((event) => /error|bounce|blocked|spam|unsubscribed/i.test(event.event ?? ""));
  if (failed) {
    return {
      success: false,
      error: failed.reason || `Brevo reported ${failed.event || "a delivery failure"}.`,
      delivery: "accepted",
    };
  }

  if (matching.some((event) => event.event === "delivered")) {
    return { success: true, error: null, delivery: "delivered" };
  }

  return { success: true, error: null, delivery: "accepted" };
}
