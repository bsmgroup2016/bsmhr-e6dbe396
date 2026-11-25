import { createClaimWorkbook, claimWorkbookBlob, downloadClaimBlob } from "@/lib/combined-claim-export";
import { groupTimeCardRows, splitTimeCardFile } from "@/core/time-card-batch";
import { countedCardHours } from "@/core/time-card-settlement";
import { matchCardWorker, uniqueCardMatch } from "@/core/time-card-matching";
import { uploadToR2, fetchR2Blob } from "@/lib/r2";
import { checkClaimWorkbook } from "@/lib/claim-sheet-check";
import { extractTimeCardData, pendingTimeCardJobs, type TimeCardExtractRow } from "@/lib/ocr";
import { buildClaimSheetFromCard, deleteClaimSheet, getClaimSheets, getClients, getCompanies, getCurrentCompany, getEmployees, getProjects, getSites, saveGeneratedClaims, upsertAttendance } from "@/lib/store";
import type { TimeCard, TimeCardEntry } from "@/lib/types";
import type { DayEntry, FieldFlag, Worker } from "./types";

const tidyCode = (code: string) => { const m = /^\s*([A-Za-z](?:[\s.]*[A-Za-z])?)[\s.\-]*(\d+)\s*$/.exec(code); return m ? `${m[1].replace(/[\s.]/g, "").toUpperCase()}-${m[2]}` : code.trim(); };
const split = (gw: number, ot: number) => (ot === 0 && gw > 8 ? { g: 8, ot: gw - 8 } : { g: gw, ot });
export const daysInMonth = (ym: string) => { const [y, m] = ym.split("-").map(Number); return new Date(Date.UTC(y, m, 0)).getUTCDate(); };

function toDays(month: string, entries: TimeCardEntry[]): DayEntry[] {
  return Array.from({ length: daysInMonth(month) }, (_, i) => {
    const day = i + 1;
    const e = entries.find((x) => Number(x.date.slice(8, 10)) === day);
    if (!e) return { day, status: "none", inTime: null, outTime: null, g: null, ot: null };
    if (/\bOFF\b/i.test(e.remarks ?? "") && !e.normalHours && !e.otHours) return { day, status: "off", inTime: null, outTime: null, g: null, ot: null };
    const c = countedCardHours(e);
    const h = split(c.normalHours, c.otHours);
    return { day, status: "work", inTime: e.checkIn ?? null, outTime: e.checkOut ?? null, g: h.g, ot: h.ot };
  });
}

/** PDFs are drawn to an image so the preview never depends on the browser's PDF viewer. */
async function previewUrl(page: File): Promise<string> {
  if (page.type !== "application/pdf") return URL.createObjectURL(page);
  try {
    const pdfjs = await import("pdfjs-dist");
    const worker = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
    pdfjs.GlobalWorkerOptions.workerSrc = worker;
    const pdf = await pdfjs.getDocument({ data: await page.arrayBuffer() }).promise;
    const p = await pdf.getPage(1);
    const vp = p.getViewport({ scale: 2 });
    const c = document.createElement("canvas");
    c.width = vp.width; c.height = vp.height;
    await p.render({ canvasContext: c.getContext("2d")!, viewport: vp, canvas: c } as never).promise;
    const b = await new Promise<Blob>((r) => c.toBlob((x) => r(x!), "image/jpeg", 0.9));
    return URL.createObjectURL(b);
  } catch { return URL.createObjectURL(page); }
}

const READ_CONCURRENCY = 3;

export type ReadResult = { workers: Worker[]; failed: string[]; month: string; site: string };

function workersFromRows(rows: TimeCardExtractRow[], preview: string, fileName: string): Worker[] {
  const groups = groupTimeCardRows(rows);
  if (!groups.length) throw new Error("no dates could be read");
  return groups.map(g => {
    const entries = [...g.entries].sort((a, b) => a.date.localeCompare(b.date)) as TimeCardEntry[];
    const first = entries[0];
    if (!first) throw new Error("no dates could be read");
    const flags: FieldFlag[] = [];
    const name = (g.identity.workerName ?? "").replace(/\s*\(\s*[0-9A-Z]{1,4}\s*\)\s*$/i, "").trim();
    if (!name) flags.push({ field: "name", reason: "could not read" });
    if (!g.identity.employeeCode) flags.push({ field: "code", reason: "could not read" });
    const low = entries.filter(e => (e.confidence ?? 1) < 0.6).length;
    if (low) flags.push({ field: "name", reason: `${low} day(s) read with low confidence` });
    const month = first.date.slice(0, 7);
    return { id: crypto.randomUUID(), name, code: tidyCode(g.identity.employeeCode ?? ""), category: (g.entries.find(e => (e as { occupation?: string }).occupation) as { occupation?: string } | undefined)?.occupation ?? "", address: "", flags, days: toDays(month, entries), site: g.identity.siteName ?? "", preview, isPdf: false, fileName, month };
  });
}
function finishRead(workers: Worker[], failed: string[]): ReadResult {
  const months = workers.map(w => (w as Worker & { month?: string }).month).filter((v): v is string => !!v);
  const sites = workers.map(w => w.site.trim()).filter(Boolean);
  const most = (xs: string[]) => [...xs].sort((a, b) => xs.filter(x => x === b).length - xs.filter(x => x === a).length)[0] ?? "";
  const site = most(sites);
  for (const w of workers) if (!w.site.trim()) w.site = site;
  return { workers: workers.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true })), failed, month: most(months), site };
}

/** Reopening the same tab reads existing owner-scoped jobs, never reuploads or reruns AI. */
export async function recoverCards(onProgress: (done: number, total: number) => void): Promise<ReadResult> {
  const jobs = await pendingTimeCardJobs(), workers: Worker[] = [], failed: string[] = [];
  if (jobs.length) onProgress(0, jobs.length);
  let done = 0;
  for (let offset = 0; offset < jobs.length; offset += READ_CONCURRENCY) {
    await Promise.all(jobs.slice(offset, offset + READ_CONCURRENCY).map(async job => {
      try {
        const ocr = await extractTimeCardData(job.ref, job.fileName);
        if (!ocr.ok) throw new Error(ocr.reason);
        const blob = await fetchR2Blob(job.ref);
        const preview = await previewUrl(new File([blob], job.fileName, { type: blob.type }));
        workers.push(...workersFromRows(ocr.data, preview, job.fileName));
      } catch (error) { failed.push(`${job.fileName}: ${error instanceof Error ? error.message : "could not recover"}`); }
      onProgress(++done, jobs.length);
    }));
  }
  return finishRead(workers, failed);
}

/** Splits PDFs per page, stores each page, reads it with OCR and returns one Worker per card. */
export async function readCards(files: File[], onProgress: (done: number, total: number) => void): Promise<ReadResult> {
  const pages: File[] = [];
  const failed: string[] = [];
  for (const f of files) { try { pages.push(...(await splitTimeCardFile(f))); } catch (e) { failed.push(`${f.name}: ${e instanceof Error ? e.message : "could not open"}`); } }
  onProgress(0, pages.length);
  const workers: Worker[] = [];
  let i = 0;
  // Pages are independent; verification order within each card remains unchanged.
  const readPage = async (page: File) => {
    try {
      const previewing = previewUrl(page);
      const up = await uploadToR2(page, "time-cards");
      const ocr = await extractTimeCardData(up.url, page.name);
      if (!ocr.ok) throw new Error(ocr.reason);
      const preview = await previewing;
      workers.push(...workersFromRows(ocr.data, preview, page.name));
    } catch (e) { failed.push(`${page.name}: ${e instanceof Error ? e.message : "could not be read"}`); }
    onProgress(++i, pages.length);
  };
  const queue = [...pages];
  await Promise.all(Array.from({ length: Math.min(READ_CONCURRENCY, queue.length) }, async () => {
    for (let page = queue.shift(); page; page = queue.shift()) await readPage(page);
  }));
  return finishRead(workers, failed);
}

function toTimeCard(w: Worker, month: string, site: string): TimeCard {
  const employees = getEmployees();
  const siteId = uniqueCardMatch(getSites(), site, (s) => [s.name, s.code]) || undefined;
  const entries: TimeCardEntry[] = w.days.filter((d) => d.status === "work" && ((d.g ?? 0) + (d.ot ?? 0)) > 0).map((d) => ({
    date: `${month}-${String(d.day).padStart(2, "0")}`, workerName: w.name, employeeCode: w.code, siteName: site, siteId,
    checkIn: d.inTime ?? undefined, checkOut: d.outTime ?? undefined, normalHours: d.g ?? 0, otHours: d.ot ?? 0, resolution: "Accepted", reviewApproved: true,
  }));
  return { id: w.id, employeeId: matchCardWorker(employees, { workerName: w.name, employeeCode: w.code }), periodStart: `${month}-01`, periodEnd: `${month}-${daysInMonth(month)}`, fileName: w.fileName, status: "Draft", entries };
}

function drafts(workers: Worker[], month: string, site: string) {
  const employees = getEmployees();
  const companyId = getCurrentCompany();
  return workers.map((w) => toTimeCard(w, month, site)).map((card) => {
    const snapshot = buildClaimSheetFromCard(card);
    const emp = employees.find((e) => e.id === card.employeeId);
    return { id: card.id, employeeId: card.employeeId || undefined, companyId: emp?.companyId ?? (companyId || undefined), periodStart: card.periodStart, periodEnd: card.periodEnd, totalDays: snapshot.length, totalNormalHours: snapshot.reduce((n, r) => n + r.normalHours, 0), totalOtHours: snapshot.reduce((n, r) => n + r.otHours, 0), snapshot };
  }).filter((d) => d.snapshot.length);
}

/** Fills the user's saved blank template (Template manager) only; never builds its own layout. */
export async function buildWorkbook(workers: Worker[], month: string, site: string, client = "") {
  const list = drafts(workers, month, site);
  if (!list.length) throw new Error("No worked hours to claim");
  return createClaimWorkbook(list as never, getEmployees(), getCompanies(), month, { projects: getProjects(), sites: getSites(), clients: getClients(), clientName: client });
}

export async function downloadExcel(workers: Worker[], month: string, site: string, client = "") {
  await downloadWorkbook(await buildWorkbook(workers, month, site, client), month);
}

export async function downloadWorkbook(workbook: Awaited<ReturnType<typeof buildWorkbook>>, month: string) {
  downloadClaimBlob(await claimWorkbookBlob(workbook), `claim_sheet_${month}.xlsx`);
}

/** Builds the exact workbook that would be downloaded and checks it cell by cell against the reviewed hours. */
export async function checkClaimExcel(workers: Worker[], month: string, site: string, client = "") {
  const workbook = await buildWorkbook(workers, month, site, client);
  const result = checkClaimWorkbook(workbook, {
    sheets: drafts(workers, month, site) as never,
    employees: getEmployees(),
    month,
    site,
    knownSites: getSites().flatMap((s) => [s.name, s.code]).filter(Boolean),
  });
  return { workbook, result };
}

/** Saves claims to HR records, safely replacing earlier claims and syncing confirmed entries to Attendance. */
export async function saveToRecords(workers: Worker[], month: string, site: string) {
  const list = drafts(workers, month, site);
  if (!list.length) throw new Error("No worked hours to claim");
  
  // 1. Save new generated claims first (await save so we don't delete on failure)
  await saveGeneratedClaims(list.map(({ id, ...c }) => ({ ...c, sourceCardId: id })));

  // 2. Safely clean up old replaced claims after successful save
  const codeOf = (snap: { employeeCode?: string; workerName?: string }[]) =>
    (snap.find((r) => r.employeeCode)?.employeeCode || snap.find((r) => r.workerName)?.workerName || "").toUpperCase();
  const codes = new Set(list.map((d) => codeOf(d.snapshot)).filter(Boolean));
  const savedSourceIds = new Set(list.map((d) => d.id));
  for (const old of getClaimSheets()) {
    const oldCode = codeOf(old.snapshot);
    // A blank code must never match: it would delete unrelated claims.
    if (oldCode && old.periodStart.startsWith(month) && codes.has(oldCode) && !savedSourceIds.has(old.id)) {
      deleteClaimSheet(old.id);
    }
  }

  // 3. Sync confirmed daily hours into Attendance table
  const cards = workers.map((w) => toTimeCard(w, month, site));
  for (const card of cards) {
    if (!card.employeeId) continue;
    for (const entry of card.entries) {
      if ((entry.normalHours || 0) + (entry.otHours || 0) > 0) {
        upsertAttendance({
          employeeId: card.employeeId,
          date: entry.date,
          siteId: entry.siteId,
          status: "Present",
          checkIn: entry.checkIn,
          checkOut: entry.checkOut,
          hoursWorked: entry.normalHours ?? 0,
          overtimeHours: entry.otHours ?? 0,
          notes: `TimeCard Claim (${entry.siteName || site})`,
        });
      }
    }
  }

  return list.length;
}
