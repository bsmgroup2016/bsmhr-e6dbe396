import { createClaimWorkbook, claimWorkbookBlob, downloadClaimBlob } from "@/lib/combined-claim-export";
import { groupTimeCardRows, splitTimeCardFile } from "@/core/time-card-batch";
import { countedCardHours } from "@/core/time-card-settlement";
import { matchCardWorker, uniqueCardMatch } from "@/core/time-card-matching";
import { uploadToR2 } from "@/lib/r2";
import { extractTimeCardData } from "@/lib/ocr";
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

export type ReadResult = { workers: Worker[]; failed: string[]; month: string; site: string };

/** Splits PDFs per page, stores each page, reads it with OCR and returns one Worker per card. */
export async function readCards(files: File[], onProgress: (done: number, total: number) => void): Promise<ReadResult> {
  const pages: File[] = [];
  const failed: string[] = [];
  for (const f of files) { try { pages.push(...(await splitTimeCardFile(f))); } catch (e) { failed.push(`${f.name}: ${e instanceof Error ? e.message : "could not open"}`); } }
  onProgress(0, pages.length);
  const workers: Worker[] = [];
  let i = 0;
  for (const page of pages) {
    try {
      const up = await uploadToR2(page, "time-cards");
      const ocr = await extractTimeCardData(up.url);
      if (!ocr.ok) throw new Error(ocr.reason);
      const groups = groupTimeCardRows(ocr.data);
      if (!groups.length) throw new Error("no dates could be read");
      const preview = await previewUrl(page);
      for (const g of groups) {
        const entries = [...g.entries].sort((a, b) => a.date.localeCompare(b.date)) as TimeCardEntry[];
        const month = entries[0].date.slice(0, 7);
        const flags: FieldFlag[] = [];
        const name = (g.identity.workerName ?? "").replace(/\s*\(\s*[0-9A-Z]{1,4}\s*\)\s*$/i, "").trim();
        if (!name) flags.push({ field: "name", reason: "could not read" });
        if (!g.identity.employeeCode) flags.push({ field: "code", reason: "could not read" });
        const low = entries.filter((e) => (e.confidence ?? 1) < 0.6).length;
        if (low) flags.push({ field: "name", reason: `${low} day(s) read with low confidence` });
        workers.push({ id: crypto.randomUUID(), name, code: tidyCode(g.identity.employeeCode ?? ""), category: (g.entries.find((e) => (e as { occupation?: string }).occupation) as { occupation?: string } | undefined)?.occupation ?? "", address: "", flags, days: toDays(month, entries), site: g.identity.siteName ?? "", preview, isPdf: false, fileName: page.name });
        (workers[workers.length - 1] as Worker & { month?: string }).month = month;
      }
    } catch (e) { failed.push(`${page.name}: ${e instanceof Error ? e.message : "could not be read"}`); }
    onProgress(++i, pages.length);
  }
  const months = workers.map((w) => (w as Worker & { month?: string }).month!).filter(Boolean);
  const sites = workers.map((w) => w.site.trim()).filter(Boolean);
  const most = (xs: string[]) => [...xs].sort((a, b) => xs.filter((x) => x === b).length - xs.filter((x) => x === a).length)[0] ?? "";
  const site = most(sites);
  for (const w of workers) if (!w.site.trim()) w.site = site;
  return { workers: workers.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true })), failed, month: most(months), site };
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
export async function buildWorkbook(workers: Worker[], month: string, site: string) {
  const list = drafts(workers, month, site);
  if (!list.length) throw new Error("No worked hours to claim");
  return createClaimWorkbook(list as never, getEmployees(), getCompanies(), month, { projects: getProjects(), sites: getSites(), clients: getClients() });
}

export async function downloadExcel(workers: Worker[], month: string, site: string) {
  downloadClaimBlob(await claimWorkbookBlob(await buildWorkbook(workers, month, site)), `claim_sheet_${month}.xlsx`);
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
  const codes = new Set(list.map((d) => codeOf(d.snapshot)));
  const savedSourceIds = new Set(list.map((d) => d.id));
  for (const old of getClaimSheets()) {
    if (old.periodStart.startsWith(month) && codes.has(codeOf(old.snapshot)) && !savedSourceIds.has(old.id)) {
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
          hoursWorked: entry.normalHours,
          overtimeHours: entry.otHours,
          notes: `TimeCard Claim (${entry.siteName || site})`,
        });
      }
    }
  }

  return list.length;
}
