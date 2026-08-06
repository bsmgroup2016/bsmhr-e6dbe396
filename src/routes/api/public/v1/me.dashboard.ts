import { createFileRoute } from "@tanstack/react-router";
import { fromAttendance, fromLeave, fromPayroll } from "@/lib/db";
import { hasAnyRole, ok, preflight, requireAuth, sbSelect } from "@/lib/api-v1.server";

/**
 * Mobile home-screen dashboard.
 *
 * Returns a single payload so the Flutter app can paint the worker/staff
 * home screen with one request instead of 4-5 separate round-trips. All data
 * is scoped by RLS exactly like the individual list endpoints.
 */
export const Route = createFileRoute("/api/public/v1/me/dashboard")({
  server: {
    handlers: {
      OPTIONS: preflight,
      GET: async ({ request }) => {
        const auth = await requireAuth(request, "dashboard");
        if ("response" in auth) return auth.response;
        const { ctx } = auth;

        const today = new Date().toISOString().slice(0, 10);
        const isStaff = hasAnyRole(ctx, ["admin", "hr", "manager", "supervisor"]);
        const employeeId = isStaff ? null : ctx.employeeId;

        // Staff dashboard: show global summary + their own profile.
        if (isStaff) {
          const [pendingLeave, unreadNotifications, profile] = await Promise.all([
            sbSelect<{ count: number }>(
              ctx,
              `leave_requests?select=count&status=eq.Pending&limit=1`,
            ),
            sbSelect<{ count: number }>(
              ctx,
              `notifications?select=count&read=eq.false&limit=1`,
            ),
            sbSelect<Record<string, unknown>>(
              ctx,
              `profiles?select=id,full_name,username,avatar_url,email&id=eq.${ctx.userId}&limit=1`,
            ),
          ]);

          return ok({
            roleView: "staff",
            profile: profile[0] ?? null,
            today: { date: today },
            counts: {
              pendingLeave: Number(pendingLeave[0]?.count ?? 0),
              unreadNotifications: Number(unreadNotifications[0]?.count ?? 0),
            },
            quickActions: [
              { label: "My Attendance", path: "/attendance" },
              { label: "Apply Leave", path: "/leave" },
              { label: "My Payslip", path: "/payroll" },
              { label: "Notifications", path: "/notifications" },
            ],
          });
        }

        // Worker/driver dashboard: personal data only.
        if (!employeeId) {
          return ok({
            roleView: "worker",
            profile: null,
            employee: null,
            today: { date: today },
            counts: {},
            quickActions: [],
            notice: "No worker profile linked to this account. Contact HR.",
          });
        }

        const [
          employee,
          profile,
          todayAttendance,
          pendingLeave,
          recentLeave,
          unreadNotifications,
          latestPayroll,
        ] = await Promise.all([
          sbSelect<Record<string, unknown>>(
            ctx,
            `employees?select=*&id=eq.${employeeId}&limit=1`,
          ),
          sbSelect<Record<string, unknown>>(
            ctx,
            `profiles?select=id,full_name,username,avatar_url,email&id=eq.${ctx.userId}&limit=1`,
          ),
          sbSelect<Record<string, unknown>>(
            ctx,
            `attendance?select=*&employee_id=eq.${employeeId}&date=eq.${today}&limit=1`,
          ),
          sbSelect<{ count: number }>(
            ctx,
            `leave_requests?select=count&employee_id=eq.${employeeId}&status=eq.Pending&limit=1`,
          ),
          sbSelect<Record<string, unknown>>(
            ctx,
            `leave_requests?select=*&employee_id=eq.${employeeId}&order=start_date.desc&limit=3`,
          ),
          sbSelect<{ count: number }>(
            ctx,
            `notifications?select=count&user_id=eq.${ctx.userId}&read=eq.false&limit=1`,
          ),
          sbSelect<Record<string, unknown>>(
            ctx,
            `payroll?select=*&employee_id=eq.${employeeId}&order=month.desc&limit=1`,
          ),
        ]);

        const row = todayAttendance[0] ? fromAttendance(todayAttendance[0]) : null;

        return ok({
          roleView: hasAnyRole(ctx, ["driver"]) ? "driver" : "worker",
          profile: profile[0] ?? null,
          employee: employee[0] ? fromEmployee(employee[0]) : null,
          today: {
            date: today,
            attendance: row,
            // Convenience booleans for the mobile punch buttons.
            canCheckIn: !row || (!row.checkIn && !row.checkOut),
            canCheckOut: !!row?.checkIn && !row?.checkOut,
            isComplete: !!row?.checkIn && !!row?.checkOut,
          },
          counts: {
            pendingLeave: Number(pendingLeave[0]?.count ?? 0),
            unreadNotifications: Number(unreadNotifications[0]?.count ?? 0),
          },
          leave: {
            recent: recentLeave.map(fromLeave),
          },
          payroll: latestPayroll[0] ? fromPayroll(latestPayroll[0]) : null,
          quickActions: [
            { label: "Punch In/Out", path: "/attendance" },
            { label: "Apply Leave", path: "/leave" },
            { label: "My Payslip", path: "/payroll" },
            { label: "Medical Leave", path: "/leave?type=Medical+Leave" },
            { label: "Notifications", path: "/notifications" },
          ],
        });
      },
    },
  },
});

// fromEmployee is not imported from db.ts in this file; mirror the small subset
// needed for the dashboard so we do not pull unrelated db mappers into scope.
function fromEmployee(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: row.id,
    pFileNumber: row.p_file_number,
    companyId: row.company_id,
    fullName: row.full_name,
    designation: row.designation,
    department: row.department,
    status: row.status,
    passType: row.pass_type,
    workPermitExpiry: row.work_permit_expiry,
    profilePhotoUrl: row.profile_photo_url,
  };
}
