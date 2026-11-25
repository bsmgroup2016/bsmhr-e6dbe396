import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { rentInvoiceSchema, rentPaymentSchema, type RentInvoice, type RentPayment } from "@/core/dormitory-billing";
const session = createMiddleware({ type: "function" }).client(async ({ next }) => {
  const { supabase } = await import("@/integrations/supabase/client");
  const { data } = await supabase.auth.getSession();
  return next({ headers: { Authorization: `Bearer ${data.session?.access_token ?? ""}` } });
});
async function billingAuth() {
  const { requireAuth, requireRole } = await import("@/lib/api-v1.server");
  const auth = await requireAuth(getRequest());
  if ("response" in auth) throw new Error("Sign in with an authorized staff account");
  if (requireRole(auth.ctx, ["admin", "manager", "hr", "accounts"])) throw new Error("Billing access required");
  return auth.ctx;
}
export const loadDormBilling = createServerFn({ method: "GET" }).middleware([session]).handler(async () => {
  const ctx = await billingAuth();
  const { sbRest } = await import("@/lib/api-v1.server");
  async function all<T>(table: string): Promise<T[] | null> {
    const rows: T[] = [];
    for (let offset = 0; ; offset += 500) {
      const res = await sbRest(ctx, `${table}?select=*&order=created_at.desc,id.desc&limit=500&offset=${offset}`);
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        if (error.code === "PGRST205" || error.code === "42P01") return null;
        throw new Error("Could not load billing records. Retry before making changes");
      }
      const page = await res.json() as T[];
      rows.push(...page);
      if (page.length < 500) return rows;
    }
  }
  const [invoices, payments] = await Promise.all([all<RentInvoice>("dorm_rent_invoices"), all<RentPayment>("dorm_rent_payments")]);
  return { ready: invoices !== null && payments !== null, invoices: invoices ?? [], payments: payments ?? [], admin: ctx.roles.includes("admin") };
});
export const mutateDormBilling = createServerFn({ method: "POST" }).middleware([session])
  .inputValidator((data: unknown) => z.discriminatedUnion("action", [
    z.object({ action: z.literal("create"), payload: rentInvoiceSchema }),
    z.object({ action: z.literal("update"), payload: rentInvoiceSchema }),
    z.object({ action: z.literal("payment"), payload: rentPaymentSchema }),
    z.object({ action: z.literal("void"), payload: z.object({ id: z.string().uuid() }) }),
  ]).parse(data)).handler(async ({ data }) => {
    const ctx = await billingAuth();
    const { sbRest } = await import("@/lib/api-v1.server");
    const res = await sbRest(ctx, "rpc/manage_dorm_rent", { method: "POST", body: JSON.stringify(data) });
    if (!res.ok) {
      const detail = await res.json().catch(() => ({}));
      if (detail.code === "23505") throw new Error("This invoice number already exists for the company");
      throw new Error(detail.code === "P0001" ? detail.message : "Billing save failed. Refresh and retry");
    }
    const id = await res.json() as string;
    const table = data.action === "payment" ? "dorm_rent_payments" : "dorm_rent_invoices";
    const check = await sbRest(ctx, `${table}?id=eq.${id}&select=*`);
    if (!check.ok) throw new Error("Save could not be confirmed. Refresh before retrying");
    const rows = await check.json();
    if (!Array.isArray(rows) || rows.length !== 1) throw new Error("Saved record could not be read back. Refresh before retrying");
    const row = rows[0];
    const expected = data.action === "payment" ? {
      invoice_id: data.payload.id, paid_on: data.payload.paidOn, amount: data.payload.amount,
      method: data.payload.method, reference: data.payload.reference, remarks: data.payload.remarks,
    } : data.action === "void" ? { voided: true } : {
      dormitory_id: data.payload.dormitoryId, company_id: data.payload.companyId,
      invoice_no: data.payload.invoiceNo, month: data.payload.month, invoice_date: data.payload.invoiceDate,
      due_date: data.payload.dueDate, total_amount: data.payload.totalAmount, remarks: data.payload.remarks,
    };
    if (Object.entries(expected).some(([key, value]) => typeof value === "number" ? Number(row[key]) !== value : row[key] !== value)) throw new Error("Saved details could not be confirmed. Refresh before retrying");
    return { id };
  });
export const setupDormBilling = createServerFn({ method: "POST" }).middleware([session]).handler(async () => {
  const ctx = await billingAuth();
  if (!ctx.roles.includes("admin")) throw new Error("Only administrators can enable billing");
  const token = process.env["SB_ACCESS_TOKEN"];
  if (!token) throw new Error("Database setup credentials are unavailable");
  const { default: query } = await import("../../db/migrations/0076_dormitory_rent_billing.sql?raw");
  const result = await fetch("https://api.supabase.com/v1/projects/thrfyeyqafmdnpexgmlc/database/query", {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ query }),
  });
  if (!result.ok) throw new Error("Could not enable billing. No billing records were created");
  const { sbRest } = await import("@/lib/api-v1.server");
  for (let attempt = 0; attempt < 8; attempt++) {
    const checks = await Promise.all(["dorm_rent_invoices", "dorm_rent_payments"].map((table) => sbRest(ctx, `${table}?select=id&limit=1`)));
    if (checks.every((check) => check.ok)) return { ready: true };
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Billing setup was submitted but could not be confirmed. Refresh before retrying");
});
