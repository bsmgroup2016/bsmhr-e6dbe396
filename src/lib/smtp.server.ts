/**
 * Custom SMTP sending (server only).
 *
 * Credentials live in the `smtp_settings` table and are managed from
 * Settings -> SMTP. Sending runs through `worker-mailer`, which speaks SMTP
 * over the Worker runtime's socket API.
 */
import { restGet, restPatch } from "./email.server";

export interface SmtpConfig {
  enabled: boolean;
  primaryProvider: "resend" | "smtp";
  host: string | null;
  port: number | null;
  secure: boolean;
  username: string | null;
  password: string | null;
  fromEmail: string | null;
  fromName: string | null;
  updatedAt: string | null;
  maxAttempts: number;
  retryDelayMs: number;
  backoffMultiplier: number;
  failoverEnabled: boolean;
  switchBack: boolean;
}

const EMPTY: SmtpConfig = {
  enabled: false,
  primaryProvider: "resend",
  host: null,
  port: 587,
  secure: false,
  username: null,
  password: null,
  fromEmail: null,
  fromName: null,
  updatedAt: null,
  maxAttempts: 3,
  retryDelayMs: 1000,
  backoffMultiplier: 2,
  failoverEnabled: true,
  switchBack: true,
};

export async function loadSmtpConfig(): Promise<SmtpConfig> {
  const rows = await restGet<any>("smtp_settings?id=eq.1&select=*");
  const r = rows[0];
  if (!r) return EMPTY;
  return {
    enabled: !!r.enabled,
    primaryProvider: r.primary_provider === "smtp" ? "smtp" : "resend",
    host: r.host ?? null,
    port: r.port ?? 587,
    secure: !!r.secure,
    username: r.username ?? null,
    password: r.password ?? null,
    fromEmail: r.from_email ?? null,
    fromName: r.from_name ?? null,
    updatedAt: r.updated_at ?? null,
    maxAttempts: Number(r.max_attempts ?? 3),
    retryDelayMs: Number(r.retry_delay_ms ?? 1000),
    backoffMultiplier: Number(r.backoff_multiplier ?? 2),
    failoverEnabled: r.failover_enabled ?? true,
    switchBack: r.switch_back ?? true,
  };
}

export async function saveSmtpConfig(patch: Record<string, unknown>) {
  return restPatch("smtp_settings?id=eq.1", { ...patch, updated_at: new Date().toISOString() });
}

export function smtpUsable(c: SmtpConfig) {
  return !!(c.enabled && c.host && c.port && c.fromEmail);
}

export async function sendViaSmtp(
  cfg: SmtpConfig,
  { to, subject, html }: { to: string | string[]; subject: string; html: string },
) {
  if (!smtpUsable(cfg)) throw new Error("SMTP is not configured");
  const { WorkerMailer } = await import("worker-mailer");
  const mailer = await WorkerMailer.connect({
    host: cfg.host!,
    port: cfg.port ?? 587,
    secure: cfg.secure,
    startTls: !cfg.secure,
    authType: "plain",
    credentials:
      cfg.username && cfg.password
        ? { username: cfg.username, password: cfg.password }
        : undefined,
  } as any);
  try {
    await mailer.send({
      from: cfg.fromName ? { name: cfg.fromName, email: cfg.fromEmail! } : cfg.fromEmail!,
      to: Array.isArray(to) ? to.map((email) => ({ email })) : { email: to },
      subject,
      html,
    } as any);
  } finally {
    try {
      await mailer.close();
    } catch {
      /* ignore */
    }
  }
  return { id: `smtp-${Date.now()}` };
}