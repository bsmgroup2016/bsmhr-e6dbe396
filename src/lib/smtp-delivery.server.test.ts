import { expect, test } from "bun:test";
import { interpretBrevoDeliveryEvents } from "@/core/smtp-delivery";
import { confirmBrevoTestDelivery } from "./smtp-delivery.server";

const input = {
  email: "person@example.com",
  fromEmail: "sender@example.com",
  subject: "SMTP test — Brevo SMTP 2",
  sentAt: "2026-11-26T09:22:00.000Z",
};

const event = (name: string, reason?: string) => ({
  email: input.email,
  subject: input.subject,
  event: name,
  date: "2026-11-26T09:22:13.625Z",
  ...(reason ? { reason } : {}),
});

test("Brevo sender rejection is returned instead of a false sent success", () => {
  const reason = "Sending has been rejected because the sender is not valid. Validate your sender or authenticate your domain";
  const result = interpretBrevoDeliveryEvents([event("error", reason), event("requests")], input);
  expect(result.success).toBe(false);
  expect(result.error).toBe(reason);
});

test("a delivered event confirms actual delivery", () => {
  const result = interpretBrevoDeliveryEvents([event("delivered"), event("requests")], input);
  expect(result).toEqual({ success: true, error: null, delivery: "delivered" });
});

test("SMTP acceptance without a delivery event remains pending, not delivered", () => {
  expect(interpretBrevoDeliveryEvents([event("requests")], input)).toEqual({
    success: true,
    error: null,
    delivery: "accepted",
  });
});

test("an earlier rejected test cannot fail a newer test with the same subject", () => {
  const old = { ...event("error", "Old rejection"), date: "2026-11-26T09:21:00.000Z" };
  expect(interpretBrevoDeliveryEvents([old], input).success).toBe(true);
});

test("the Brevo report is queried and its rejection reason reaches the admin", async () => {
  const reason = "Validate your sender or authenticate your domain";
  const result = await confirmBrevoTestDelivery("fixture-key", input, {
    fetcher: async (url) => url.endsWith("/senders")
      ? Response.json({ senders: [{ email: input.fromEmail, active: true }] })
      : Response.json({ events: [event("error", reason)] }),
    attempts: 1,
  });
  expect(result.success).toBe(false);
  expect(result.error).toBe(reason);
});

test("one account’s API key never reads another SMTP account’s delivery events", async () => {
  let eventReads = 0;
  const result = await confirmBrevoTestDelivery("second-account-key", input, {
    fetcher: async (url) => {
      if (url.endsWith("/senders")) {
        return Response.json({ senders: [{ email: "other-account@example.com", active: true }] });
      }
      eventReads += 1;
      return Response.json({ events: [event("error", "Wrong account rejection")] });
    },
    attempts: 1,
  });
  expect(result).toEqual({ success: true, error: null, delivery: "accepted" });
  expect(eventReads).toBe(0);
});
