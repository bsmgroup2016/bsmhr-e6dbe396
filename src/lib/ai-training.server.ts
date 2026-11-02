/**
 * Chatbot training: crawls every assistant table into a knowledge base,
 * generates "skills" (how-to lookup recipes) with the chatbot AI, and builds
 * the extra system prompt the assistant uses on every question.
 */
import { ASSISTANT_TABLES } from "./assistant.server";
import { activeProviders } from "./api-integrations.server";

const SUPABASE_URL = "https://thrfyeyqafmdnpexgmlc.supabase.co";

async function db(path: string, init: RequestInit = {}) {
  const key = process.env.SB_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Service key missing");
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=representation", ...(init.headers ?? {}) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`DB ${res.status}: ${text.slice(0, 200)}`);
  return { data: text ? JSON.parse(text) : [], res };
}

export type Knowledge = { id: string; kind: "snapshot" | "note" | "skill"; source: string; title: string; content: string; enabled: boolean; updated_at: string };
export type Settings = { crawls_per_day: number; auto_skills: boolean; skills_generated_at: string | null };

export async function getSettings(): Promise<Settings> {
  return (await db("ai_training_settings?id=eq.1")).data[0];
}
export async function saveSettings(s: Partial<Settings>) {
  await db("ai_training_settings?id=eq.1", { method: "PATCH", body: JSON.stringify({ ...s, updated_at: new Date().toISOString() }) });
}
export const listKnowledge = async (): Promise<Knowledge[]> => (await db("ai_knowledge?order=kind.asc,title.asc&limit=500")).data;
export const listRuns = async () => (await db("ai_crawl_runs?order=started_at.desc&limit=20")).data;

const BREAKDOWN = /^(status|type|pass_type|work_pass_type|category|designation|role|gender|nationality|payment_status|stage|priority)$/;

/** Summarise one table: row count, columns and value breakdowns (no raw personal data). */
async function snapshotTable(table: string) {
  const { data, res } = await db(`${table}?select=*&limit=1000`, { headers: { Prefer: "count=exact" } });
  const rows = data as Record<string, unknown>[];
  const total = Number(res.headers.get("content-range")?.split("/")[1] ?? rows.length);
  const cols = rows[0] ? Object.keys(rows[0]) : [];
  const parts = [`Table "${table}": ${total} rows.`, cols.length ? `Columns: ${cols.join(", ")}.` : "Table is empty."];
  for (const c of cols.filter((c) => BREAKDOWN.test(c))) {
    const counts = new Map<string, number>();
    for (const r of rows) {
      const v = r[c] == null ? "(blank)" : String(r[c]).slice(0, 40);
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([v, n]) => `${v} ${n}`);
    parts.push(`${c}: ${top.join(", ")}${rows.length < total ? " (sample of 1000)" : ""}.`);
  }
  const today = new Date().toISOString().slice(0, 10);
  const soon = new Date(Date.now() + 60 * 864e5).toISOString().slice(0, 10);
  for (const c of cols.filter((c) => /expir/.test(c))) {
    const n = rows.filter((r) => typeof r[c] === "string" && (r[c] as string) >= today && (r[c] as string) <= soon).length;
    const past = rows.filter((r) => typeof r[c] === "string" && (r[c] as string) < today).length;
    parts.push(`${c}: ${n} within 60 days, ${past} already past.`);
  }
  return { content: parts.join(" "), rows: total };
}

async function chat(prompt: string) {
  let last = "";
  for (const p of await activeProviders("chatbot")) {
    try {
      const res = await fetch(p.url, {
        method: "POST",
        headers: { Authorization: `Bearer ${p.key}`, "Content-Type": "application/json", ...p.extra },
        body: JSON.stringify({ model: p.model, messages: [{ role: "user", content: prompt }] }),
      });
      if (!res.ok) throw new Error(`${p.name} ${res.status}: ${(await res.text()).slice(0, 150)}`);
      const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const text = j.choices?.[0]?.message?.content;
      if (text) return { text, provider: `${p.name} (${p.model})` };
      throw new Error(`${p.name}: empty reply`);
    } catch (e) {
      last = e instanceof Error ? e.message : String(e);
    }
  }
  throw new Error(`All chatbot providers failed. ${last}`);
}

/** Ask the AI to write lookup recipes from the current snapshots. Replaces old AI-made skills. */
export async function generateSkills() {
  const snaps = (await listKnowledge()).filter((k) => k.kind === "snapshot").map((k) => k.content).join("\n").slice(0, 24000);
  if (!snaps) throw new Error("Run a crawl first");
  const { text, provider } = await chat(
    "You train an HR assistant for a Singapore manpower company (companies BSM, VRL, Pluto). Below is a summary of its database tables.\n" +
      "Write 10-15 SKILLS: short, practical recipes telling the assistant exactly which table(s), columns and filters to use for common questions " +
      "(work permit expiry, active workers, deployments, payroll CPF/levy, unpaid invoices, leave, dormitory beds, vehicles, PPE stock, etc). " +
      'Only use tables/columns that appear below. Reply ONLY with a JSON array: [{"title":"...","content":"..."}].\n\n' + snaps,
  );
  const m = text.match(/\[[\s\S]*\]/);
  if (!m) throw new Error("AI did not return skills");
  const skills = (JSON.parse(m[0]) as { title?: string; content?: string }[])
    .filter((s) => s.title && s.content)
    .slice(0, 20)
    .map((s) => ({ kind: "skill", source: "ai", title: String(s.title).slice(0, 120), content: String(s.content).slice(0, 1500) }));
  await db("ai_knowledge?kind=eq.skill&source=eq.ai", { method: "DELETE" });
  if (skills.length) await db("ai_knowledge", { method: "POST", body: JSON.stringify(skills) });
  await saveSettings({ skills_generated_at: new Date().toISOString() });
  return { count: skills.length, provider };
}

export async function runCrawl(trigger: "manual" | "auto", withSkills: boolean) {
  const run = (await db("ai_crawl_runs", { method: "POST", body: JSON.stringify({ trigger }) })).data[0];
  let tables = 0, rows = 0, skills = 0, provider: string | null = null;
  try {
    for (const t of ASSISTANT_TABLES) {
      try {
        const s = await snapshotTable(t);
        const existing = (await db(`ai_knowledge?kind=eq.snapshot&title=eq.${t}&select=id`)).data[0];
        const row = { kind: "snapshot", source: "crawl", title: t, content: s.content, updated_at: new Date().toISOString() };
        if (existing) await db(`ai_knowledge?id=eq.${existing.id}`, { method: "PATCH", body: JSON.stringify(row) });
        else await db("ai_knowledge", { method: "POST", body: JSON.stringify(row) });
        tables++;
        rows += s.rows;
      } catch (e) {
        console.error("crawl table failed", t, e);
      }
    }
    let error: string | null = null;
    if (withSkills) {
      try {
        const g = await generateSkills();
        skills = g.count;
        provider = g.provider;
      } catch (e) {
        error = `Skills: ${e instanceof Error ? e.message : e}`.slice(0, 400);
      }
    }
    await db(`ai_crawl_runs?id=eq.${run.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: error ? "partial" : "done", tables_scanned: tables, rows_seen: rows, skills_generated: skills, provider, error, finished_at: new Date().toISOString() }),
    });
  } catch (e) {
    await db(`ai_crawl_runs?id=eq.${run.id}`, { method: "PATCH", body: JSON.stringify({ status: "failed", error: String(e).slice(0, 400), finished_at: new Date().toISOString() }) });
    throw e;
  }
  return { tables, rows, skills };
}

/** Hourly cron: crawl when due (24h / crawls_per_day since the last run). Skills at most once per ~20h. */
export async function cronTick() {
  const s = await getSettings();
  if (!s || s.crawls_per_day <= 0) return { skipped: "auto crawl off" };
  const last = (await db("ai_crawl_runs?order=started_at.desc&limit=1")).data[0];
  const gapMs = (24 / s.crawls_per_day) * 3600e3 - 10 * 60e3;
  if (last && Date.now() - new Date(last.started_at).getTime() < gapMs) return { skipped: "not due" };
  const skillsDue = s.auto_skills && (!s.skills_generated_at || Date.now() - new Date(s.skills_generated_at).getTime() > 20 * 3600e3);
  return runCrawl("auto", skillsDue);
}

export async function addKnowledge(k: { kind: "note" | "skill"; title: string; content: string }) {
  await db("ai_knowledge", { method: "POST", body: JSON.stringify({ ...k, source: "manual" }) });
}
export async function updateKnowledge(id: string, patch: { title?: string; content?: string; enabled?: boolean }) {
  // Editing an AI skill makes it manual so the next generation does not overwrite it.
  const extra = patch.content !== undefined || patch.title !== undefined ? { source: "manual" } : {};
  await db(`ai_knowledge?id=eq.${id}&kind=neq.snapshot`, { method: "PATCH", body: JSON.stringify({ ...patch, ...extra, updated_at: new Date().toISOString() }) });
  if (patch.enabled !== undefined) await db(`ai_knowledge?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ enabled: patch.enabled }) });
}
export const deleteKnowledge = (id: string) => db(`ai_knowledge?id=eq.${id}`, { method: "DELETE" });

/** Extra system prompt built from enabled notes, skills and table snapshots. */
export async function knowledgePrompt(): Promise<string> {
  try {
    const all = (await db("ai_knowledge?enabled=eq.true&order=kind.asc&limit=500")).data as Knowledge[];
    const notes = all.filter((k) => k.kind === "note").map((k) => `- ${k.title}: ${k.content}`);
    const skills = all.filter((k) => k.kind === "skill").map((k) => `- ${k.title}: ${k.content}`);
    const snaps = all.filter((k) => k.kind === "snapshot").map((k) => k.content);
    let out = "";
    if (notes.length) out += `\n\nCOMPANY KNOWLEDGE (from admin):\n${notes.join("\n")}`;
    if (skills.length) out += `\n\nSKILLS (how to look things up):\n${skills.join("\n")}`;
    if (snaps.length) out += `\n\nDATABASE MAP (latest crawl; always confirm live numbers with tools):\n${snaps.join("\n")}`;
    return out.slice(0, 20000);
  } catch {
    return "";
  }
}
