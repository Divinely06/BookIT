import type { Request, Response } from "express";
import { sql } from "../../_db.js";
import { createBookingNotifications } from "../../bookings.js";

export default async function handler(request: Request, response: Response) {
  if (request.method !== "PATCH") {
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  const bookingId = Number(request.query.id);
  const { status, userId, remarks } = request.body ?? {};
  if (!Number.isInteger(bookingId) || !status || !userId) {
    response.status(400).json({ error: "Invalid status update" });
    return;
  }

  try {
    const [authorization] = await sql`
      select b.status as current_status, u.role, o.faculty_adviser_id
      from booking b
      join app_user u on u.user_id = ${userId}
      join student_organization o on o.org_id = b.org_id
      where b.booking_id = ${bookingId}
    `;
    const transitions: Record<string, { current: string; next: string[] }> = {
      faculty: { current: "Faculty review", next: ["Dean review", "Rejected"] },
      dean: { current: "Dean review", next: ["CDMO review", "Rejected"] },
      admin_review: { current: "Admin review", next: ["CDMO review", "Rejected"] },
      cdmo: { current: "CDMO review", next: ["Final admin review", "Rejected"] },
      final_admin: { current: "Final admin review", next: ["Approved", "Rejected"] },
    };
    const workflowRole = authorization?.role === "admin" && authorization.current_status === "Admin review"
      ? "admin_review"
      : authorization?.role === "admin" && authorization.current_status === "Final admin review"
        ? "final_admin"
        : authorization?.role;
    const rule = authorization ? transitions[workflowRole] : undefined;
    const assigned = authorization?.role === "faculty"
      ? authorization.faculty_adviser_id === Number(userId)
      : Boolean(rule);
    if (!authorization || !rule || !assigned || authorization.current_status !== rule.current || !rule.next.includes(status)) {
      response.status(403).json({ error: "You are not authorized for this workflow step" });
      return;
    }

    const approvalLevelByRole: Record<string, number> = {
      faculty: 1,
      dean: 2,
      admin_review: 2,
      cdmo: 3,
      final_admin: 4,
    };
    const [booking] = await sql`
      update booking
      set status = ${status},
          rejection_reason = ${status === "Rejected" ? remarks ?? "No reason provided" : null}
      where booking_id = ${bookingId}
      returning booking_id, status
    `;
    if (!booking) {
      response.status(404).json({ error: "Booking not found" });
      return;
    }

    if (approvalLevelByRole[workflowRole]) {
      await sql`
        insert into approval (booking_id, approved_user_id, approval_level, status, date_actioned, remarks)
        values (${bookingId}, ${userId}, ${approvalLevelByRole[workflowRole]}, ${status === "Rejected" ? "Rejected" : "Approved"}, now(), ${remarks ?? null})
        on conflict (booking_id, approval_level) do update set
          approved_user_id = excluded.approved_user_id,
          status = excluded.status,
          date_actioned = excluded.date_actioned,
          remarks = excluded.remarks
      `;
    }
    await createBookingNotifications(bookingId, status, authorization.role, remarks);
    response.json(booking);
  } catch (error) {
    console.error("Booking status update failed", error);
    response.status(409).json({ error: "Unable to update booking status" });
  }
}
