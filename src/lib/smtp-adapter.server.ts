import { loadSmtpTransport } from "./smtp-runtime.server";
import type { SmtpServer } from "./smtp.server";
import type { MailInput } from "./email.server";

// Opaque native signature: only worker-mailer consumes these socket values.
type SocketModule = { connect: (...args: unknown[]) => unknown };
let workerConnect: SocketModule["connect"] | undefined;

/** Called only by the bundled worker-mailer socket bridge after initialization. */
export function getWorkerConnect(): SocketModule["connect"] {
  if (!workerConnect) throw new Error("Worker SMTP transport is not initialized");
  return workerConnect;
}

export function isWorkersRuntime() {
  return typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";
}

export async function sendSmtp(s: SmtpServer, mail: MailInput) {
  // Retain the preview safety guard; deployment transport is chosen at runtime.
  return loadSmtpTransport(import.meta.env.DEV, async () => {
    if (isWorkersRuntime()) {
      // Keep the native module lazy and confined to this adapter. The build
      // bridge prevents worker-mailer from importing it in the Node graph.
      const nativeModule = ["cloudflare", "sockets"].join(":");
      const sockets = await import(/* @vite-ignore */ nativeModule) as SocketModule;
      workerConnect = sockets.connect;
      const { WorkerMailer } = await import("worker-mailer");
      const mailer = await WorkerMailer.connect({
        host: s.host, port: s.port, secure: s.secure, startTls: !s.secure,
        authType: "plain",
        ...(s.username && s.password ? { credentials: { username: s.username, password: s.password } } : {}),
      });
      try {
        await mailer.send({
          from: s.from_name ? { name: s.from_name, email: s.from_email } : s.from_email,
          to: Array.isArray(mail.to) ? mail.to.map(email => ({ email })) : { email: mail.to },
          subject: mail.subject, html: mail.html,
        });
      } finally { try { await mailer.close(); } catch { /* preserve existing close behavior */ } }
    } else {
      const { default: nodemailer } = await import("nodemailer");
      const transport = nodemailer.createTransport({
        host: s.host, port: s.port, secure: s.secure, requireTLS: !s.secure,
        ...(s.username && s.password ? { auth: { user: s.username, pass: s.password }, authMethod: "PLAIN" } : {}),
      });
      try {
        await transport.sendMail({
          from: s.from_name ? { name: s.from_name, address: s.from_email } : s.from_email,
          to: mail.to, subject: mail.subject, html: mail.html,
        });
      } finally { transport.close(); }
    }
    return { id: `smtp-${Date.now()}` };
  });
}
