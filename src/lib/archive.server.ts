import { AwsClient } from "aws4fetch";
import { gzipSync, gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { ARCHIVE_TABLES, ARCHIVE_MAX_BYTES, ARCHIVE_LABELS, DEFAULT_ARCHIVE_SETTINGS, DELETE_ONLY, archiveCutoffs, archiveMonth, monthlyArchiveDue, verifyArchivePayload, type ArchiveTable, type ArchiveHold, type ArchiveSettings } from "@/core/archive-policy";

const ROOT = "archives/v1/";
type Row = Record<string, unknown>;
type Batch = { rows: Row[]; messages: Row[] };
type Run = { id: string; createdAt: string; cutoffs: Record<ArchiveTable, string>; tableIndex: number; batch: number; status: "running" | "complete" | "failed"; deleted: number; archived: number; skipped: number; error?: string; pending?: { key: string; fingerprint: string; archived: boolean; commitStarted: boolean }; files: string[] };
type Control = { settings: ArchiveSettings; holds: ArchiveHold[]; active?: Run; last?: Run; completedMonth?: string; leaseUntil?: number; token?: string };
type Catalog = { id: string; createdAt: string; status: string; deleted: number; archived: number; skipped: number; files: string[]; error?: string }[];
function hash(text: string) { return createHash("sha256").update(text).digest("hex"); }
function client() {
  const account = process.env.R2_ACCOUNT_ID; const access = process.env.R2_ACCESS_KEY_ID; const secret = process.env.R2_SECRET_ACCESS_KEY; const bucket = process.env.R2_BUCKET_NAME;
  if (!account || !access || !secret || !bucket) throw new Error("Main R2 bucket is not configured.");
  return { aws: new AwsClient({ accessKeyId: access, secretAccessKey: secret, service: "s3", region: "auto" }), base: `https://${account}.r2.cloudflarestorage.com/${bucket}`, bucket };
}
async function object(key: string, init?: RequestInit) {
  if (!key.startsWith(ROOT) || key.includes("..")) throw new Error("Invalid archive file.");
  const c = client(); return c.aws.fetch(`${c.base}/${key}`, init);
}
async function read<T>(key: string, fallback: T): Promise<{ value: T; etag: string | null }> {
  const r = await object(key); if (r.status === 404) return { value: fallback, etag: null };
  if (!r.ok) throw new Error(`Archive storage read failed (${r.status}).`);
  return { value: await r.json() as T, etag: r.headers.get("etag") };
}
async function write(key: string, value: unknown, etag?: string | null) {
  const r = await object(key, { method: "PUT", headers: { "Content-Type": "application/json", ...(etag === undefined ? {} : etag ? { "If-Match": etag } : { "If-None-Match": "*" }) }, body: JSON.stringify(value) });
  if (!r.ok) throw new Error(r.status === 412 ? "Another archive action is running. Please retry later." : `Archive progress could not be saved (${r.status}). Nothing further was deleted.`);
  return r.headers.get("etag");
}
const controlKey = `${ROOT}control/settings.json`;
async function control() { return read<Control>(controlKey, { settings: { ...DEFAULT_ARCHIVE_SETTINGS }, holds: [] }); }
function service() {
  const key = process.env.SB_SERVICE_ROLE_KEY; if (!key) throw new Error("Database service is unavailable.");
  return createClient("https://thrfyeyqafmdnpexgmlc.supabase.co", key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init) => {
    const headers = new Headers(init?.headers); headers.set("apikey", key); if (key.startsWith("sb_")) headers.delete("Authorization");
    return fetch(input, { ...init, headers });
  } } });
}
export async function requireArchiveAdmin(request: Request) {
  const bearer = request.headers.get("authorization"); if (!bearer?.startsWith("Bearer ")) throw new Error("Unauthorized");
  // Verify session and role through the caller's RLS client, before opening privileged clients.
  const { supabase } = await import("@/integrations/supabase/client");
  const caller = createClient(supabase.supabaseUrl, supabase.supabaseKey, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: bearer } } });
  const { data: user, error } = await caller.auth.getUser(bearer.slice(7)); if (error || !user.user) throw new Error("Unauthorized");
  const { data: roles, error: roleError } = await caller.from("user_roles").select("role").eq("user_id", user.user.id);
  if (roleError || !roles?.some((r) => r.role === "admin")) throw new Error("Forbidden");
  return user.user.id;
}
async function rpc<T>(action: string, table: ArchiveTable, cutoff: string, holds: ArchiveHold[], expected: Batch = { rows: [], messages: [] }) {
  const { data, error } = await service().rpc("safe_archive_batch", { p_action: action, p_table: table, p_cutoff: cutoff, p_holds: holds.filter((h) => h.table === table).map((h) => h.id), p_expected: expected });
  if (error) throw new Error(error.code === "PGRST202" ? "The approved database safety routine has not been installed. Cleanup is unavailable." : `Archive database operation failed: ${error.message}`);
  return data as T;
}
export async function archiveOverview(month: string) {
  const { value: c } = await control(); const { value: catalog } = await read<Catalog>(`${ROOT}catalog/${month}.json`, []);
  return { settings: c.settings, holds: c.holds, active: c.active, last: c.last, catalog, bucket: client().bucket };
}
export async function archiveDryRun() {
  const { value: c } = await control(); const cutoffs = archiveCutoffs(new Date()); const result = [];
  for (const table of ARCHIVE_TABLES) result.push({ table, label: ARCHIVE_LABELS[table], cutoff: cutoffs[table], action: DELETE_ONLY.includes(table) ? "Delete only" : "Archive then delete", ...await rpc<{ rows: number; bytes: number; messages: number }>("count", table, cutoffs[table], c.holds) });
  return { checkedAt: new Date().toISOString(), rows: result, holds: c.holds.length };
}
export async function archiveConfigure(patch: Partial<ArchiveSettings>, holds?: ArchiveHold[]) {
  const { value: c, etag } = await control(); if (c.leaseUntil && c.leaseUntil > Date.now()) throw new Error("A cleanup step is running. Try again after it finishes.");
  if (patch.monthly && !c.settings.firstRunConfirmed) throw new Error("Complete the first confirmed cleanup before enabling monthly runs.");
  c.settings = { ...c.settings, ...patch };
  if (holds) c.holds = holds;
  await write(controlKey, c, etag); return c.settings;
}
export async function startArchiveRun(confirmed: boolean) {
  if (!confirmed) throw new Error("The first cleanup needs your confirmation.");
  const preview = await archiveDryRun(); const { value: c, etag } = await control();
  if (c.active || (c.leaseUntil && c.leaseUntil > Date.now())) throw new Error("A run already exists. Resume it instead.");
  c.settings.firstRunConfirmed = true; c.settings.paused = false;
  c.active = { id: crypto.randomUUID(), createdAt: preview.checkedAt, cutoffs: archiveCutoffs(new Date(preview.checkedAt)), tableIndex: 0, batch: 0, status: "running", deleted: 0, archived: 0, skipped: 0, files: [] };
  await write(controlKey, c, etag); return c.active;
}
async function unpack(key: string) {
  const r = await object(key); if (!r.ok) throw new Error("Verified archive could not be read. Cleanup stopped.");
  const zipped = new Uint8Array(await r.arrayBuffer()); if (zipped.byteLength > ARCHIVE_MAX_BYTES) throw new Error("Archive exceeds the safe size limit.");
  const text = gunzipSync(zipped, { maxOutputLength: ARCHIVE_MAX_BYTES }).toString("utf8");
  return { text, batch: JSON.parse(text) as Batch };
}
async function catalogRun(run: Run) {
  const key = `${ROOT}catalog/${archiveMonth(new Date(run.createdAt))}.json`; const { value, etag } = await read<Catalog>(key, []);
  const row = { id: run.id, createdAt: run.createdAt, status: run.status, deleted: run.deleted, archived: run.archived, skipped: run.skipped, files: run.files, error: run.error };
  const next = value.filter((r) => r.id !== run.id); next.push(row); await write(key, next, etag);
}
export async function archiveStep() {
  const loaded = await control(); const c = loaded.value;
  if (!c.active || c.settings.paused) return { idle: true };
  if (c.leaseUntil && c.leaseUntil > Date.now()) throw new Error("Another archive step is running.");
  // Conditional R2 writes provide durable mutual exclusion, not worker-local globals.
  c.token = crypto.randomUUID(); c.leaseUntil = Date.now() + 10 * 60000;
  let etag = await write(controlKey, c, loaded.etag); const run = c.active;
  const save = async () => { etag = await write(controlKey, c, etag); };
  try {
    run.status = "running"; delete run.error;
    const table = ARCHIVE_TABLES[run.tableIndex];
    if (!table) {
      run.status = "complete"; c.last = run; delete c.active; c.completedMonth = archiveMonth(new Date());
      await catalogRun(run); c.leaseUntil = 0; await save(); return { run };
    }
    if (!run.pending) {
      const batch = await rpc<Batch>("preview", table, run.cutoffs[table], c.holds);
      // Bound both rows and bytes; split oversized non-chat batches without losing fields.
      while (JSON.stringify(batch).length > ARCHIVE_MAX_BYTES / 2 && batch.rows.length > 1) batch.rows.pop();
      const text = JSON.stringify(batch);
      if (new TextEncoder().encode(text).length > ARCHIVE_MAX_BYTES) throw new Error("This record is too large for a safe batch. It was not deleted.");
      if (!batch.rows.length) { run.tableIndex++; c.leaseUntil = 0; await save(); return { run }; }
      const date = new Date(run.createdAt).toISOString().slice(0, 7).replace("-", "/");
      const key = `${ROOT}${table}/${date}/${run.id}/batch-${String(++run.batch).padStart(6, "0")}.jsonl.gz`;
      const bytes = gzipSync(text);
      const put = await object(key, { method: "PUT", headers: { "Content-Type": "application/gzip", "If-None-Match": "*" }, body: bytes as unknown as BodyInit });
      if (!put.ok) throw new Error(`Archive upload failed (${put.status}). Nothing was deleted.`);
      const downloaded = await unpack(key); await verifyArchivePayload(text, downloaded.text);
      run.pending = { key, fingerprint: hash(text), archived: !DELETE_ONLY.includes(table), commitStarted: false };
      // Delete-only rows use a tiny temporary recovery/progress payload, not a permanent archive.
      await write(`${ROOT}runs/${run.id}/manifest.json`, run); await save();
    }
    const pending = run.pending;
    const saved = await unpack(pending.key); if (hash(saved.text) !== pending.fingerprint) throw new Error("Archive fingerprint mismatch. Nothing was deleted.");
    if (pending.commitStarted) throw new Error("A previous deletion response was interrupted. Admin reconciliation is required before continuing; no blind retry was made.");
    pending.commitStarted = true; await write(`${ROOT}runs/${run.id}/manifest.json`, run); await save();
    const verdict = await rpc<{ deleted: number; changed: number }>("commit", table, run.cutoffs[table], c.holds, saved.batch);
    run.deleted += verdict.deleted; run.skipped += verdict.changed;
    if (pending.archived) { run.archived += saved.batch.rows.length + saved.batch.messages.length; run.files.push(pending.key); }
    delete run.pending;
    if (verdict.changed) { run.tableIndex++; }
    await write(`${ROOT}runs/${run.id}/manifest.json`, run);
    if (!pending.archived) { const remove = await object(pending.key, { method: "DELETE" }); if (!remove.ok && remove.status !== 404) throw new Error("Temporary cleanup progress could not be removed."); }
    await catalogRun(run); c.leaseUntil = 0; await save(); return { run };
  } catch (e) {
    run.status = "failed"; run.error = e instanceof Error ? e.message : "Cleanup failed."; c.leaseUntil = 0;
    await save(); await catalogRun(run); return { run };
  }
}
export async function archiveCron() {
  const { value: c } = await control();
  if (!c.settings.monthly || c.settings.paused || !c.settings.firstRunConfirmed) return { idle: true };
  if (c.active?.status === "failed") return { pausedAfterFailure: true };
  if (!c.active && monthlyArchiveDue(new Date()) && c.completedMonth !== archiveMonth(new Date())) await startArchiveRun(true);
  return archiveStep();
}
export async function archiveDownload(key: string, readable: boolean) {
  if (!key.startsWith(ROOT) || !key.endsWith(".jsonl.gz") || key.includes("..") || DELETE_ONLY.some((t) => key.startsWith(`${ROOT}${t}/`))) throw new Error("Invalid archive file.");
  const file = await unpack(key);
  return new Response(readable ? JSON.stringify(file.batch, null, 2) : gzipSync(file.text) as unknown as BodyInit, { headers: { "Cache-Control": "private, no-store", "Content-Type": readable ? "application/json" : "application/gzip", "Content-Disposition": `attachment; filename="archive-${readable ? "records.json" : "records.json.gz"}"` } });
}