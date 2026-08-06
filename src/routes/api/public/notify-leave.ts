import { createFileRoute } from "@tanstack/react-router";
import { esc, layout, restGet, sendMail } from "@/lib/email.server";
import { userRoles, verifyUser } from "@/lib/r2.server";

/** Notify an employee that their leave request was approved or rejected. */
export const Route = createFileRoute("/api/public/notify-leave")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const userId = await verifyUser(request);
        if (!userId) return new Response("Unauthorized", { status: 401 });
        const roles = await userRoles(userId);
        if (!roles.some((r) => ["admin", "hr", "manager", "supervisor"].includes(r))) {
          return new Response("Forbidden", { status: 403 });
        }

        let body: { leaveId?: string; status?: string };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return new Response("Invalid body", { status: 400 });
        }
        const leaveId = String(body.leaveId ?? "");
        const status = String(body.status ?? "");
        if (!leaveId || !["Approved", "Rejected"].includes(status)) {
          return new Response("Invalid input", { status: 400 });
        }

        const [leave] = await restGet(
          `leave_requests?select=employee_id,leave_type,start_date,end_date,days,remarks&id=eq.${encodeURIComponent(leaveId)}&limit=1`,
        );
        if (!leave) return new Response("Leave request not found", { status: 404 });
        const [employee] = await restGet(
          `employees?select=name,email,user_id&id=eq.${encodeURIComponent(leave.employee_id)}&limit=1`,
        );
        const approved = status === "Approved";

        // Push + in-app notification (works even when there is no email on file).
        if (employee?.user_id) {
          try {
            const { sendPush } = await import("@/lib/push.server");
            await sendPush({
              userIds: [employee.user_id],
              title: `Leave request ${status.toLowerCase()}`,
              body: `${leave.leave_type} ${leave.start_date} to ${leave.end_date} was ${status.toLowerCase()}.`,
              category: "leave",
              data: { leaveId, status },
            });
          } catch {
            /* push failure must never block the approval flow */
          }
        }

        if (!employee?.email) return Response.json({ sent: false, reason: "no_employee_email" });

        const html = layout(`Leave request ${status.toLowerCase()}`, `
          <p>Dear ${esc(employee.name)},</p>
          <p>Your <b>${esc(leave.leave_type)}</b> request from <b>${esc(leave.start_date)}</b> to
          <b>${esc(leave.end_date)}</b> (${esc(leave.days)} day(s)) has been
          <b style="color:${approved ? "#059669" : "#dc2626"}">${esc(status.toUpperCase())}</b>.</p>
          ${leave.remarks ? `<p>Remarks: ${esc(leave.remarks)}</p>` : ""}
          <p style="color:#64748b">Please contact HR if you have any questions.</p>`);

        try {
          await sendMail({ to: employee.email, subject: `Leave request ${status.toLowerCase()}`, html });
        } catch (e) {
          return new Response(e instanceof Error ? e.message : "Send failed", { status: 502 });
        }
        return Response.json({ sent: true });
      },
    },
  },
});