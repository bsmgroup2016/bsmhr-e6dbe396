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