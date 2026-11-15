import { test, expect } from "bun:test";
import { supabase } from "@/integrations/supabase/client";
import { clearSessionStore, getClaimSheets, saveGeneratedClaims } from "./store";

test("claim save rejects failures, confirms all IDs, and retries without duplicate records", async () => {
  const original = supabase.from;
  let mode = "fail";
  const written: string[][] = [];
  // No requests leave this test: replace only the local client's table method.
  supabase.from = ((table: string) => {
    if (table !== "claim_sheets") throw new Error("Unexpected table");
    return { upsert: (rows: Record<string, unknown>[]) => {
      written.push(rows.map(row => String(row.id)));
      return { select: async () => mode === "fail" ? { data: null, error: { message: "Save denied" } } : { data: mode === "partial" ? rows.slice(0, 1) : rows, error: null } };
    } };
  }) as typeof supabase.from;
  clearSessionStore();
  const claims = ["00000000-0000-4000-8000-000000000001", "00000000-0000-4000-8000-000000000002"].map(sourceCardId => ({ sourceCardId, periodStart: "2026-11-01", periodEnd: "2026-11-30", totalDays: 1, totalNormalHours: 8, totalOtHours: 3.5, snapshot: [{ sourceCardId, date: "2026-11-15", normalHours: 8, otHours: 3.5, status: "Present" }] }));
  try {
    await expect(saveGeneratedClaims(claims)).rejects.toThrow("Save denied");
    expect(getClaimSheets()).toHaveLength(0);
    mode = "partial";
    await expect(saveGeneratedClaims(claims)).rejects.toThrow("confirm all");
    expect(getClaimSheets()).toHaveLength(0);
    mode = "ok";
    await saveGeneratedClaims(claims); await saveGeneratedClaims(claims);
    expect(getClaimSheets()).toHaveLength(2);
    expect(written[0]).toEqual(written[3]);
  } finally { supabase.from = original; clearSessionStore(); }
});