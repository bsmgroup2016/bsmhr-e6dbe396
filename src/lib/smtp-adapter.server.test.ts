import { expect, spyOn, test } from "bun:test";
import nodemailer from "nodemailer";
import { isWorkersRuntime, sendSmtp } from "./smtp-adapter.server";
import type { SmtpServer } from "./smtp.server";
const server: SmtpServer = {
  id: "fixture", label: "Fixture SMTP", host: "smtp.example", port: 587, secure: false,
  username: "fixture-user", password: "fixture-password", from_email: "sender@example.com", from_name: "Fixture",
  priority: 1, enabled: true, daily_limit: 300, sent_today: 0, sent_day: null,
  cooldown_until: null, last_error: null, last_used_at: null, updated_at: "2026-11-28",
};
test("runtime selection recognizes Workers and does not mistake Node for Workers", () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  try {
    Object.defineProperty(globalThis, "navigator", { configurable: true, value: { userAgent: "Node.js/22" } });
    expect(isWorkersRuntime()).toBe(false);
    Object.defineProperty(globalThis, "navigator", { configurable: true, value: { userAgent: "Cloudflare-Workers" } });
    expect(isWorkersRuntime()).toBe(true);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "navigator", descriptor);
    else Reflect.deleteProperty(globalThis, "navigator");
  }
});
test("Node SMTP retains TLS, sender, recipients and content, and closes transport", async () => {
  let closed = false;
  const messages: unknown[] = [];
  const mock = spyOn(nodemailer, "createTransport").mockReturnValue({
    sendMail: async (mail: unknown) => { messages.push(mail); return {}; },
    close: () => { closed = true; },
  } as unknown as ReturnType<typeof nodemailer.createTransport>);
  try {
    const result = await sendSmtp(server, { to: ["one@example.com", "two@example.com"], subject: "Fixture", html: "<p>Fixture</p>" });
    expect(result.id).toStartWith("smtp-");
    expect(mock.mock.calls[0]?.[0]).toEqual({ host: "smtp.example", port: 587, secure: false, requireTLS: true, auth: { user: "fixture-user", pass: "fixture-password" }, authMethod: "PLAIN" });
    expect(messages).toEqual([{ from: { name: "Fixture", address: "sender@example.com" }, to: ["one@example.com", "two@example.com"], subject: "Fixture", html: "<p>Fixture</p>" }]);
    expect(closed).toBe(true);
  } finally { mock.mockRestore(); }
});
test("Node SMTP preserves provider errors and closes after rejection", async () => {
  const failure = new Error("535 Authentication failed");
  let closed = false;
  const mock = spyOn(nodemailer, "createTransport").mockReturnValue({ sendMail: async () => { throw failure; }, close: () => { closed = true; } } as unknown as ReturnType<typeof nodemailer.createTransport>);
  try {
    await expect(sendSmtp({ ...server, secure: true, port: 465 }, { to: "one@example.com", subject: "Fixture", html: "Fixture" })).rejects.toBe(failure);
    expect(mock.mock.calls[0]?.[0]).toMatchObject({ secure: true, requireTLS: false, port: 465 });
    expect(closed).toBe(true);
  } finally { mock.mockRestore(); }
});
