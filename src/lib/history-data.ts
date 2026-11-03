import { queryOptions } from "@tanstack/react-query";
import { apiData } from "@/lib/api-client";
import { collectAllPages } from "@/core/data-pagination";
import { sessionDataCache } from "@/lib/session-data-cache";
import { fromAttendance, fromIssuance } from "@/lib/db";
import type { Attendance, AssetIssuance } from "@/lib/types";

export type HistoryFilters = Record<string, string>;
type RawPage = { rows: Record<string, unknown>[]; total: number };

export async function historyPage(table: "attendance" | "asset_issuances", filters: HistoryFilters, offset = 0, limit = 50) {
  return sessionDataCache.get(`${table}|page|${JSON.stringify(filters)}|${offset}|${limit}`, () =>
    apiData<RawPage>("/data", { query: { table, ...filters, offset, limit } }));
}

export async function allHistory<T extends Attendance | AssetIssuance>(table: "attendance" | "asset_issuances", filters: HistoryFilters): Promise<T[]> {
  const rows = await collectAllPages((offset, limit) => historyPage(table, filters, offset, limit));
  return rows.map((row) => table === "attendance" ? fromAttendance(row) : fromIssuance(row)) as T[];
}

export function historyQueryOptions(table: "attendance" | "asset_issuances", userId: string, filters: HistoryFilters, offset: number) {
  return queryOptions({
    queryKey: ["history", userId, table, filters, offset],
    queryFn: () => historyPage(table, filters, offset),
    staleTime: Infinity, gcTime: Infinity, retry: false,
  });
}

export function historySummaryOptions(table: "attendance" | "asset_issuances", userId: string, filters: HistoryFilters) {
  return queryOptions({
    queryKey: ["history-summary", userId, table, filters],
    queryFn: () => sessionDataCache.get(`${table}|summary|${JSON.stringify(filters)}`, () => apiData<HistorySummary>("/data", { query: { table, ...filters, summary: "1" } })),
    staleTime: Infinity, gcTime: Infinity, retry: false,
  });
}

export type WorkerLedger = { employeeId: string; total: number; holding: number; lastIssue: string; pendingAck: number; dueReplacement: number; lost: number; value: number; recovery: number };
export type HistorySummary = {
  total: number; counts: Record<string, number>; hours: number; ot: number;
  overdue: number; replacement: number; unacknowledged: number; recovery: number;
  issuedQuantity: Record<string, number>; workers: WorkerLedger[];
  attendanceWorkers: { employeeId: string; presentDays: number; absentDays: number; leaveDays: number; normalHours: number; otHours: number; totalHours: number }[];
};