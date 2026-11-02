/**
 * Custom SMTP sending (server only) — multiple servers with automatic switching.
 *
 * Servers live in `smtp_servers` (service-role only), managed from Settings -> SMTP.
 * Global options (primary channel, Resend failover) stay in `smtp_settings`.
 * A server is skipped when it is off, has hit its daily limit, or is cooling
 * down after a limit / failure; the next one in priority order takes over.
 */
import { restGet, restPatch } from "./email.server";

export interface SmtpServer {
  id: string;
  label: string;
  host: string;
  port: number;
  secure: boolean;
  username: string | null;
  password: string | null;
  from_email: string;
  from_name: string | null;
  priority: number;
  enabled: boolean;
  daily_limit: number | null;
  sent_today: number;
  sent_day: string | null;
  cooldown_until: string | null;
  last_error: string | null;
  last_used_at: string | null;
  updated_at: string;
}

export interface SmtpGlobal {
  primaryProvider: "resend" | "smtp";
  failoverEnabled: boolean;
}

/** Singapore calendar day, so daily limits reset at local midnight. */
export function today() {
  return new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);
}

export async function loadGlobal(): Promise<SmtpGlobal> {
  const r = (await restGet<any>("smtp_settings?id=eq.1&select=primary_provider,failover_enabled"))[0];
  return { primaryProvider: r?.primary_provider === "smtp" ? "smtp" : "resend", failoverEnabled: r?.failover_enabled ?? true };
}

export async function saveGlobal(g: Partial<SmtpGlobal>) {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (g.primaryProvider) patch.primary_provider = g.primaryProvider;
  if (g.failoverEnabled !== undefined) patch.failover_enabled = g.failoverEnabled;
  return restPatch("smtp_settings?id=eq.1", patch);
}

export async function listServers(): Promise<SmtpServer[]> {
  return restGet<SmtpServer>("smtp_servers?select=*&order=priority.asc");
}

export function sentToday(s: SmtpServer) {
  return s.sent_day === today() ? s.sent_today : 0;
}

/** Why a server can't be used right now (null = ready). */
export function unavailableReason(s: SmtpServer): string | null {
  if (!s.enabled) return "Turned off";
  if (s.daily_limit && sentToday(s) >= s.daily_limit) return "Daily limit reached";
  if (s.cooldown_until && new Date(s.cooldown_until).getTime() > Date.now()) return "Resting after limit / error";
  return null;
}

/** Looks like the provider is refusing because of a quota / rate limit. */
export function isLimitError(msg: string) {
  return /\b(421|450|451|452|454)\b|5\.4\.5|4\.7\.0|limit|quota|rate|too many|exceeded|throttl/i.test(msg);
}

export async function sendWith(
  s: SmtpServer,
  { to, subject, html }: { to: string | string[]; subject: string; html: string },
) {
  const { WorkerMailer } = await import("worker-mailer");
  const mailer = await WorkerMailer.connect({
    host: s.host,
    port: s.port,
    secure: s.secure,
    startTls: !s.secure,
    authType: "plain",
    credentials: s.username && s.password ? { username: s.username, password: s.password } : undefined,
  } as any);
  try {
    await mailer.send({
      from: s.from_name ? { name: s.from_name, email: s.from_email } : s.from_email,
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

async function markSuccess(s: SmtpServer) {
  const day = today();
  await restPatch(`smtp_servers?id=eq.${s.id}`, {
    sent_today: (s.sent_day === day ? s.sent_today : 0) + 1,
    sent_day: day,
    last_used_at: new Date().toISOString(),
    last_error: null,
    cooldown_until: null,
  });
}

async function markFailure(s: SmtpServer, msg: string) {
  // Limit hit → rest 1 hour; other error → rest 5 minutes so the next server takes over.
  const mins = isLimitError(msg) ? 60 : 5;
  await restPatch(`smtp_servers?id=eq.${s.id}`, {
    last_error: msg.slice(0, 300),
    cooldown_until: new Date(Date.now() + mins * 60_000).toISOString(),
  });
}

/** Send through the first ready SMTP server, switching automatically on failure. */
export async function sendViaSmtpPool(mail: { to: string | string[]; subject: string; html: string }) {
  const servers = (await listServers()).filter((s) => !unavailableReason(s));
  if (servers.length === 0) throw new Error("No SMTP server is available right now");
  let last: unknown = null;
  for (const s of servers) {
    try {
      const res = await sendWith(s, mail);
      await markSuccess(s);
      return res;
    } catch (e) {
      last = e;
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`SMTP ${s.label} failed, switching:`, msg);
      await markFailure(s, msg);
    }
  }
  throw last instanceof Error ? last : new Error(String(last));
}

export async function smtpPoolReady() {
  return (await listServers()).some((s) => !unavailableReason(s));
}
