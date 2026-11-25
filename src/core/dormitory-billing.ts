import { z } from "zod";
import type { BedAllocation } from "@/lib/types";

export const billingDate = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Singapore" }).format(new Date());
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((v) => !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v, "Invalid date");
const money = z.number().finite().positive().max(999999999).refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 0.00001, "Use at most two decimal places");
export const rentInvoiceSchema = z.object({
  id: z.string().uuid().optional(), dormitoryId: z.string().uuid(), companyId: z.string().uuid(),
  invoiceNo: z.string().trim().min(1).max(80), month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  invoiceDate: date, dueDate: date, totalAmount: money, remarks: z.string().trim().max(2000),
}).refine((v) => v.dueDate >= v.invoiceDate, { message: "Due date cannot precede invoice date", path: ["dueDate"] });
export const rentPaymentSchema = z.object({ id: z.string().uuid(), requestId: z.string().uuid(), paidOn: date, amount: money, method: z.enum(["Bank transfer", "PayNow", "Cash", "Cheque", "Other"]), reference: z.string().trim().max(120), remarks: z.string().trim().max(1000) });
export type RentInvoice = { id: string; dormitory_id: string; company_id: string; invoice_no: string; month: string; invoice_date: string; due_date: string; total_amount: number; remarks: string; voided: boolean; created_at: string; updated_at: string };
export type RentPayment = { id: string; invoice_id: string; paid_on: string; amount: number; method: string; reference: string; remarks: string; created_at: string };
export function rentBalance(invoice: RentInvoice, payments: RentPayment[], today: string) {
  const paidCents = payments.filter((p) => p.invoice_id === invoice.id).reduce((s, p) => s + Math.round(Number(p.amount) * 100), 0);
  const outstanding = Math.max(0, Math.round(Number(invoice.total_amount) * 100) - paidCents) / 100;
  return { paid: paidCents / 100, outstanding: invoice.voided ? 0 : outstanding, status: invoice.voided ? "Void" : outstanding === 0 ? "Paid" : invoice.due_date < today ? "Overdue" : paidCents > 0 ? "Partial" : "Unpaid" };
}
/** Full monthly allocation rent is a reviewable estimate, never implicit prorating. */
export function monthlyRentEstimate(allocations: BedAllocation[], dormId: string, month: string, companyEmployeeIds: Set<string>) {
  const start = `${month}-01`;
  const end = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).toISOString().slice(0, 10);
  const rows = allocations.filter((a) => a.dormitoryId === dormId && companyEmployeeIds.has(a.employeeId) && a.status !== "Reserved" && a.checkInDate <= end && (!a.checkOutDate || a.checkOutDate >= start));
  return { beds: rows.length, total: rows.reduce((s, a) => s + Math.round(a.monthlyRent * 100), 0) / 100 };
}
export function validatePaymentAmount(amount: number, outstanding: number) {
  if (!Number.isFinite(amount) || amount <= 0 || Math.round(amount * 100) > Math.round(outstanding * 100)) throw new Error("Payment must be positive and cannot exceed the outstanding balance");
}