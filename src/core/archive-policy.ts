export const ARCHIVE_BATCH_SIZE = 250;
export const ARCHIVE_MAX_BYTES = 2_000_000;
export const ARCHIVE_TABLES = ["cron.job_run_details", "api_rate_limits", "ai_crawl_runs", "driver_task_pings", "live_chats", "audit_logs"] as const;
export type ArchiveTable = typeof ARCHIVE_TABLES[number];
export const ARCHIVE_LABELS: Record<ArchiveTable, string> = {
  "cron.job_run_details": "Finished job logs", api_rate_limits: "Expired API counters", ai_crawl_runs: "Finished crawl history",
  driver_task_pings: "Driver locations", live_chats: "Closed conversations", audit_logs: "Audit history",
};
export const DELETE_ONLY: ArchiveTable[] = ["cron.job_run_details", "api_rate_limits", "ai_crawl_runs"];
export type ArchiveSettings = { monthly: boolean; paused: boolean; firstRunConfirmed: boolean };
export type ArchiveHold = { table: ArchiveTable; id: string; reason: string };
export const DEFAULT_ARCHIVE_SETTINGS: ArchiveSettings = { monthly: false, paused: false, firstRunConfirmed: false };
export function archiveCutoffs(now: Date) {
  const days = (n: number) => new Date(now.getTime() - n * 86400000).toISOString();
  const year = new Date(now); const month = year.getUTCMonth(); const day = year.getUTCDate();
  year.setUTCDate(1); year.setUTCFullYear(year.getUTCFullYear() - 1); year.setUTCMonth(month);
  year.setUTCDate(Math.min(day, new Date(Date.UTC(year.getUTCFullYear(), month + 1, 0)).getUTCDate()));
  return { "cron.job_run_details": days(7), api_rate_limits: days(7), ai_crawl_runs: days(30), driver_task_pings: days(60), live_chats: days(90), audit_logs: year.toISOString() };
}
export function archiveMonth(now: Date) { return new Date(now.getTime() + 8 * 3600000).toISOString().slice(0, 7); }
export function monthlyArchiveDue(now: Date) {
  const sg = new Date(now.getTime() + 8 * 3600000);
  return sg.getUTCDay() === 0 && sg.getUTCDate() <= 7 && sg.getUTCHours() === 2;
}
export function archiveRecordId(table: ArchiveTable, row: Record<string, unknown>) {
  if (table === "api_rate_limits") return `${row.bucket}|${row.window_start}`;
  return String(table === "cron.job_run_details" ? row.runid : row.id);
}
export function assertArchiveTable(table: string): asserts table is ArchiveTable {
  if (!(ARCHIVE_TABLES as readonly string[]).includes(table)) throw new Error("This table is protected from cleanup.");
}
export async function verifyArchivePayload(expected: string, downloaded: string) {
  const a = JSON.parse(expected); const b = JSON.parse(downloaded);
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error("Archive verification failed. Nothing was deleted.");
  if (!Array.isArray(b.rows) || !Array.isArray(b.messages)) throw new Error("Invalid archive records.");
  return { rows: b.rows.length, messages: b.messages.length };
}