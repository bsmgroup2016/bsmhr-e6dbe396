/**
 * Outgoing notification emails (Resend).
 *
 * Keys live in project secrets: RESEND_API_KEY, RESEND_FROM, CRON_SECRET.
 */
const SUPABASE_URL = "https://thrfyeyqafmdnpexgmlc.supabase.co";

export function serviceKey() {
  const key = process.env.SB_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Service key missing");
  return key;
}

/** Service-role REST read (server only). */
export async function restGet<T = any>(path: string): Promise<T[]> {
  const key = serviceKey();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) return [];
  return (await res.json()) as T[];
}

export interface MailInput {
  to: string | string[];
  subject: string;
  html: string;
}

/** Service-role REST write (server only). Returns true on success. */
export async function restPatch(path: string, body: unknown): Promise<boolean> {
  const key = serviceKey();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: "PATCH",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) console.error("restPatch failed", res.status, await res.text());
  return res.ok;
}

export async function sendMail({ to, subject, html }: MailInput) {
  return sendMailInternal({ to, subject, html });
}

/** Service-role REST insert (server only). Returns inserted row count. */
export async function restPost(path: string, rows: unknown[]): Promise<number> {
  if (rows.length === 0) return 0;
  const key = serviceKey();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    console.error("restPost failed", res.status, await res.text());
    return 0;
  }
  return rows.length;
}

async function sendMailInternal({ to, subject, html }: MailInput) {
  const { loadSmtpConfig, sendViaSmtp, smtpUsable } = await import("./smtp.server");
  let cfg = null as Awaited<ReturnType<typeof loadSmtpConfig>> | null;
  try {
    cfg = await loadSmtpConfig();
  } catch {
    cfg = null;
  }

  const smtpReady = !!cfg && smtpUsable(cfg);
  const maxAttempts = Math.max(1, cfg?.maxAttempts ?? 3);
  const baseDelay = Math.max(0, cfg?.retryDelayMs ?? 1000);
  const factor = Math.max(1, cfg?.backoffMultiplier ?? 2);
  const failover = cfg ? cfg.failoverEnabled : true;
  const switchBack = cfg ? cfg.switchBack : true;

  const trySmtp = () => sendViaSmtp(cfg!, { to, subject, html });
  const tryResend = () => sendViaResend({ to, subject, html });

  // Ordered channel list: primary first, then failover (and optional switch back).
  const primaryIsSmtp = smtpReady && cfg!.primaryProvider === "smtp";
  const channels: { name: string; run: () => Promise<{ id: string }> }[] = [];
  if (primaryIsSmtp) {
    channels.push({ name: "SMTP", run: trySmtp });
    if (failover) channels.push({ name: "Resend", run: tryResend });
    if (failover && switchBack) channels.push({ name: "SMTP (retry)", run: trySmtp });
  } else {
    channels.push({ name: "Resend", run: tryResend });
    if (failover && smtpReady) channels.push({ name: "SMTP", run: trySmtp });
    if (failover && smtpReady && switchBack)
      channels.push({ name: "Resend (retry)", run: tryResend });
  }

  let lastError: unknown = new Error("No email channel available");
  for (const channel of channels) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const res = await channel.run();
        if (channel.name !== channels[0]!.name || attempt > 1)
          console.log(`Email sent via ${channel.name} (attempt ${attempt})`);
        return res;
      } catch (e) {
        lastError = e;
        console.error(`Email send failed via ${channel.name} (attempt ${attempt}/${maxAttempts}):`, e);
        if (attempt < maxAttempts) {
          const wait = Math.round(baseDelay * Math.pow(factor, attempt - 1));
          if (wait > 0) await new Promise((r) => setTimeout(r, wait));
        }
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export async function sendViaResend({ to, subject, html }: MailInput) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not configured");
  const from = process.env.RESEND_FROM || "BSM Workforce <onboarding@resend.dev>";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ from, to: Array.isArray(to) ? to : [to], subject, html }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Email send failed [${res.status}]: ${body}`);
  }
  return (await res.json()) as { id: string };
}

const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string,
  );

export function layout(title: string, bodyHtml: string) {
  return `<!doctype html><html><body style="margin:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
  <div style="max-width:600px;margin:0 auto;padding:24px">
    <div style="border-radius:12px;border:1px solid #e2e8f0;overflow:hidden">
      <div style="background:#0f172a;color:#ffffff;padding:16px 20px;font-size:16px;font-weight:bold">BSM Workforce &amp; Operations</div>
      <div style="padding:20px">
        <h1 style="font-size:18px;margin:0 0 12px">${esc(title)}</h1>
        ${bodyHtml}
      </div>
    </div>
    <p style="color:#64748b;font-size:12px;margin-top:16px">Automated message from your workforce management system.</p>
  </div></body></html>`;
}

export function list(items: string[]) {
  if (items.length === 0) return `<p style="color:#64748b">Nothing to report.</p>`;
  return `<ul style="padding-left:18px;margin:0 0 16px">${items
    .map((i) => `<li style="margin-bottom:6px">${i}</li>`)
    .join("")}</ul>`;
}

export { esc };