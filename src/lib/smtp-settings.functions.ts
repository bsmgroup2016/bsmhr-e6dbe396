import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getSmtpSettings = createServerFn({ method: "GET" }).handler(async () => {
  const { loadSmtpConfig, smtpUsable } = await import("./smtp.server");
  const cfg = await loadSmtpConfig();
  const { password, ...rest } = cfg;
  return {
    ...rest,
    hasPassword: !!password,
    usable: smtpUsable(cfg),
    resendConfigured: !!process.env.RESEND_API_KEY,
  };
});

const schema = z.object({
  enabled: z.boolean().optional(),
  primaryProvider: z.enum(["resend", "smtp"]).optional(),
  host: z.string().trim().max(200).optional(),
  port: z.number().int().min(1).max(65535).optional(),
  secure: z.boolean().optional(),
  username: z.string().trim().max(200).optional(),
  password: z.string().max(500).optional(),
  fromEmail: z.string().trim().max(200).optional(),
  fromName: z.string().trim().max(120).optional(),
});

export const saveSmtpSettings = createServerFn({ method: "POST" })
  .inputValidator((data) => schema.parse(data))
  .handler(async ({ data }) => {
    const { saveSmtpConfig } = await import("./smtp.server");
    const patch: Record<string, unknown> = {};
    if (data.enabled !== undefined) patch.enabled = data.enabled;
    if (data.primaryProvider !== undefined) patch.primary_provider = data.primaryProvider;
    if (data.host !== undefined) patch.host = data.host || null;
    if (data.port !== undefined) patch.port = data.port;
    if (data.secure !== undefined) patch.secure = data.secure;
    if (data.username !== undefined) patch.username = data.username || null;
    if (data.password) patch.password = data.password;
    if (data.fromEmail !== undefined) patch.from_email = data.fromEmail || null;
    if (data.fromName !== undefined) patch.from_name = data.fromName || null;
    const ok = await saveSmtpConfig(patch);
    return ok
      ? { success: true, error: null }
      : { success: false, error: "Could not save SMTP settings" };
  });

export const testSmtpSettings = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ to: z.string().email() }).parse(data))
  .handler(async ({ data }) => {
    try {
      const { loadSmtpConfig, sendViaSmtp } = await import("./smtp.server");
      const { layout } = await import("./email.server");
      const cfg = await loadSmtpConfig();
      await sendViaSmtp(cfg, {
        to: data.to,
        subject: "SMTP test message",
        html: layout(
          "SMTP test successful",
          "<p>Your custom SMTP server is working. Notification emails can now be delivered through it.</p>",
        ),
      });
      return { success: true, error: null };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  });