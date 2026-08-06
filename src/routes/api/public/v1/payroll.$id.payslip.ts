import { createFileRoute } from "@tanstack/react-router";
import {
  corsHeaders,
  fail,
  hasAnyRole,
  preflight,
  requireAuth,
  sbSelect,
} from "@/lib/api-v1.server";

/**
 * Payslip PDF for one payroll entry.
 * Workers may download only their own payslip; staff may download any.
 * Returns `application/pdf` bytes so a Flutter/HTTP client can save or share it.
 */
export const Route = createFileRoute("/api/public/v1/payroll/$id/payslip")({
  server: {
    handlers: {
      OPTIONS: preflight,
      GET: async ({ request, params }) => {
        const auth = await requireAuth(request);
        if ("response" in auth) return auth.response;
        const { ctx } = auth;

        const rows = await sbSelect<Record<string, any>>(
          ctx,
          `payroll?select=*&id=eq.${encodeURIComponent(params.id)}&limit=1`,
        );
        const pay = rows[0];
        if (!pay) return fail(404, "not_found", "Payslip not found");

        const isStaff = hasAnyRole(ctx, ["admin", "hr", "manager"]);
        if (!isStaff && pay['employee_id'] !== ctx.employeeId)
          return fail(403, "forbidden", "You can only download your own payslip");

        const emps = await sbSelect<Record<string, any>>(
          ctx,
          `employees?select=id,name,employee_code,fin,trade,pass_type,bank_account,company_id&id=eq.${encodeURIComponent(pay['employee_id'])}&limit=1`,
        );
        const emp = emps[0] ?? {};
        const companies = emp['company_id']
          ? await sbSelect<Record<string, any>>(
              ctx,
              `companies?select=name,uen,address&id=eq.${encodeURIComponent(emp['company_id'])}&limit=1`,
            )
          : [];

        const { buildPayslipPdf } = await import("@/lib/payslip-pdf.server");
        const bytes = await buildPayslipPdf({
          month: String(pay['month'] ?? ""),
          employee: {
            name: String(emp['name'] ?? "Employee"),
            pFileNo: emp['employee_code'] ?? null,
            fin: emp['fin'] ?? null,
            designation: emp['trade'] ?? null,
            passType: emp['pass_type'] ?? null,
            bankAccountNo: emp['bank_account'] ?? null,
          },
          company: {
            name: companies[0]?.['name'] ?? null,
            uen: companies[0]?.['uen'] ?? null,
            address: companies[0]?.['address'] ?? null,
          },
          basicSalary: Number(pay['basic_salary'] ?? 0),
          overtimePay: Number(pay['overtime_pay'] ?? 0),
          overtimeHours: Number(pay['overtime_hours'] ?? 0),
          allowances: Number(pay['allowances'] ?? 0),
          cpfEmployee: Number(pay['cpf_employee'] ?? 0),
          accommodationDeduction: Number(pay['accommodation_deduction'] ?? 0),
          loanRepayment: Number(pay['loan_repayment'] ?? 0),
          otherDeductions: Number(pay['other_deductions'] ?? 0),
          deductions: Number(pay['deductions'] ?? 0),
          shgFund: pay['shg_fund'] ?? null,
          shgAmount: Number(pay['shg_amount'] ?? 0),
          netPay: Number(pay['net_pay'] ?? 0),
          status: pay['status'] ?? null,
          paidAt: pay['paid_at'] ?? null,
        });

        const safeName = String(emp['name'] ?? "employee").replace(/[^a-z0-9]+/gi, "-");
        return new Response(bytes as unknown as BodyInit, {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="payslip-${safeName}-${String(pay['month'] ?? "")}.pdf"`,
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});
