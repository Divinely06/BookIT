import type { Request, Response } from "express";
import { sql } from "./_db.js";

export const config = { api: { bodyParser: { sizeLimit: "15mb" } } };

async function createBookingNotifications(bookingId: number, status: string, actorRole: string, remarks?: string) {
  try {
    const [booking] = await sql`
      select b.event_name, b.org_id, b.requested_by_user_id, o.faculty_adviser_id, o.org_name
      from booking b
      join student_organization o on o.org_id = b.org_id
      where b.booking_id = ${bookingId}
    `;
    if (!booking) return;

    const roleLabels: Record<string, string> = {
      organization: "the organization",
      faculty: "the faculty adviser",
      dean: "the dean",
      admin: "the administrator",
      cdmo: "the CDMO",
    };
    const actor = roleLabels[actorRole] ?? actorRole;
    const nextStage = status === "Dean review"
      ? "the dean"
      : status === "Admin review"
        ? "the administrator"
      : status === "CDMO review"
        ? "the CDMO"
        : status === "Final admin review"
          ? "the administrator"
          : "the organization";
    const outcome = status === "Rejected"
      ? `The request was rejected by ${actor}. Reason: ${remarks || "No reason provided"}`
      : status === "Approved"
        ? "The request was approved by the administrator."
        : `The request was approved by ${actor} and is now waiting for ${nextStage}.`;
    const nextRole = status === "Dean review"
      ? "dean"
      : status === "Admin review"
        ? "admin"
      : status === "CDMO review"
        ? "cdmo"
        : status === "Final admin review"
          ? "admin"
          : "";
    const notificationTitle = status === "Faculty review"
      ? "Faculty review needed"
      : status === "Dean review"
        ? "Dean review needed"
        : status === "Admin review"
          ? "Admin review needed"
        : status === "CDMO review"
          ? "CDMO review needed"
          : status === "Final admin review"
            ? "Admin confirmation needed"
            : status === "Rejected"
              ? "Booking request rejected"
              : "Booking request approved";
    const recipients = await sql`
      select distinct recipient.user_id
      from (
        select b.requested_by_user_id as user_id
        from booking b where b.booking_id = ${bookingId}
        union
        select membership.user_id
        from user_organization membership
        where membership.org_id = ${booking.org_id} and membership.status = 'Active'
        union
        select ${booking.faculty_adviser_id} as user_id
        where ${status} = 'Faculty review'
        union
        select u.user_id
        from app_user u where u.role = ${nextRole}
      ) recipient
      where recipient.user_id is not null
    `;
    for (const recipient of recipients) {
      await sql`
        insert into notification (user_id, booking_id, title, message)
        values (${recipient.user_id}, ${bookingId}, ${notificationTitle}, ${outcome})
      `;
    }
  } catch (error) {
    console.error("In-app booking notification failed", error);
  }
}

async function listBookings(response: Response) {
  const { userId, role } = (response.req as Request).query;
  if (!["organization", "faculty", "dean", "admin", "cdmo"].includes(String(role)) || !userId || Number.isNaN(Number(userId))) {
    response.status(401).json({ error: "A valid user identity is required" });
    return;
  }
  const bookings = await sql`
    select b.booking_id, b.org_id, o.org_name, b.room_id, r.room_name,
      b.requested_by_user_id, b.event_name, b.participant_count,
      b.date_requested, to_char(b.event_date, 'YYYY-MM-DD') as event_date,
      to_char(b.start_time, 'HH24:MI') as start_time,
      to_char(b.end_time, 'HH24:MI') as end_time,
      b.purpose, b.rejection_reason, b.status,
      coalesce((select json_agg(concat(be.quantity_requested, ' × ', e.equipment_name) order by e.equipment_name)
        from booking_equipment be join equipment e on e.equipment_id = be.equipment_id
        where be.booking_id = b.booking_id), '[]'::json) as equipment,
      coalesce((select json_agg(json_build_object(
        'name', d.file_name, 'type', d.content_type, 'data', d.file_path
      )) from document d where d.booking_id = b.booking_id), '[]'::json) as documents
    from booking b
    join student_organization o on o.org_id = b.org_id
    join room r on r.room_id = b.room_id
    where (
      (${role} = 'faculty' and o.faculty_adviser_id = ${Number(userId)})
      or (${role} = 'organization' and exists (
        select 1 from user_organization membership
        where membership.user_id = ${Number(userId)}
          and membership.org_id = o.org_id and membership.status = 'Active'
      ))
          or ${role} in ('dean', 'admin', 'cdmo')
    )
    order by b.date_requested desc
  `;
  response.json(bookings);
}

export default async function handler(request: Request, response: Response) {
  try {
    if (request.method === "GET") {
      await listBookings(response);
      return;
    }

    if (request.method === "POST") {
      const {
        orgId,
        roomId,
        requestedByUserId,
        eventName,
        participantCount,
        eventDate,
        startTime,
        endTime,
        purpose,
        clientRequestId,
        attachment,
        equipment = [],
        activityApplication,
        formData,
      } = request.body ?? {};
      const fullFormData = (activityApplication && typeof activityApplication === "object" && !Array.isArray(activityApplication)
        ? activityApplication
        : (formData && typeof formData === "object" && !Array.isArray(formData) ? formData : {})) as Record<string, unknown>;
      const [requester] = requestedByUserId
        ? await sql`
            select u.user_id from app_user u
            join user_organization membership on membership.user_id = u.user_id
              and membership.org_id = ${orgId} and membership.status = 'Active'
            join student_organization organization on organization.org_id = membership.org_id
              and organization.status = 'Active'
            where u.user_id = ${requestedByUserId} and u.role = 'organization'
          `
        : await sql`
            select u.user_id from app_user u
            join student_organization o on o.contact_email = u.email
            where o.org_id = ${orgId} and o.status = 'Active' and u.role = 'organization' limit 1
          `;
      if (!orgId || !roomId || !requester?.user_id || !eventName || !participantCount || !eventDate || !startTime || !endTime || !purpose) {
        response.status(400).json({ error: "Missing required booking fields" });
        return;
      }
      if (!clientRequestId) {
        response.status(400).json({ error: "Booking request ID is required" });
        return;
      }
      if (!Number.isInteger(Number(orgId)) || !Number.isInteger(Number(roomId))
        || !Number.isInteger(Number(participantCount)) || Number(participantCount) < 1
        || !/^\d{4}-\d{2}-\d{2}$/.test(String(eventDate))
        || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(startTime))
        || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(endTime))
        || String(startTime) >= String(endTime)) {
        response.status(400).json({ error: "Invalid booking date, time, or participant count" });
        return;
      }
      if (!Array.isArray(equipment) || equipment.some((item: unknown) => {
        if (typeof item === "string") return false;
        if (!item || typeof item !== "object") return true;
        const request = item as { equipmentId?: unknown; quantity?: unknown };
        return !Number.isInteger(Number(request.equipmentId)) || Number(request.equipmentId) < 1
          || !Number.isInteger(Number(request.quantity)) || Number(request.quantity) < 1;
      })) {
        response.status(400).json({ error: "Invalid equipment request" });
        return;
      }
      if (attachment?.data && attachment.data.length > 14 * 1024 * 1024) {
        response.status(413).json({ error: "Attached files must be 10 MB or smaller" });
        return;
      }
      if (attachment?.name && !/\.(pdf|docx)$/i.test(String(attachment.name))) {
        response.status(415).json({ error: "Only PDF and DOCX files are allowed" });
        return;
      }
      const [room] = await sql`
        select room_id
        from room
        where room_id = ${Number(roomId)} and availability_status = 'Available'
      `;
      if (!room) {
        response.status(409).json({ error: "This venue is unavailable" });
        return;
      }
      const [roomConflict] = await sql`
        select booking_id
        from booking
        where room_id = ${Number(roomId)}
          and event_date = ${eventDate}::date
          and status <> 'Rejected'
          and (${eventDate}::date + ${startTime}::time, ${eventDate}::date + ${endTime}::time)
            overlaps (event_date + start_time, event_date + end_time)
        limit 1
      `;
      if (roomConflict) {
        response.status(409).json({ error: "This venue is already requested for that date and time" });
        return;
      }
      for (const item of equipment) {
        const request = typeof item === "string"
          ? (() => {
              const match = item.match(/^(.*?) × (\d+)$/);
              return match ? { name: match[1], quantity: Number(match[2]) } : null;
            })()
          : { equipmentId: Number(item.equipmentId), quantity: Number(item.quantity) };
        if (!request || request.quantity < 1) {
          response.status(400).json({ error: "Invalid equipment quantity" });
          return;
        }
        const [equipmentRow] = await sql`
          select equipment_id, quantity_available, status from equipment
          where ${"equipmentId" in request ? sql`equipment_id = ${request.equipmentId}` : sql`equipment_name = ${request.name}`}
        `;
        const [reserved] = equipmentRow ? await sql`
          select coalesce(sum(be.quantity_requested), 0) as quantity_reserved
          from booking_equipment be
          join booking b on b.booking_id = be.booking_id
          where be.equipment_id = ${equipmentRow.equipment_id}
            and b.event_date = ${eventDate}::date
            and b.status <> 'Rejected'
            and (${eventDate}::date + ${startTime}::time, ${eventDate}::date + ${endTime}::time)
              overlaps (b.event_date + b.start_time, b.event_date + b.end_time)
        ` : [{ quantity_reserved: 0 }];
        if (!equipmentRow || equipmentRow.status !== "Available"
          || request.quantity > Number(equipmentRow.quantity_available) - Number(reserved.quantity_reserved)) {
          response.status(400).json({ error: "Requested equipment is unavailable" });
          return;
        }
      }
      const [existing] = await sql`
        select booking_id from booking where client_request_id = ${clientRequestId}
      `;
      if (existing) {
        response.status(200).json({ created: false, bookingId: existing.booking_id });
        return;
      }
      const [booking] = await sql`
        insert into booking (
          org_id, room_id, requested_by_user_id, event_name, participant_count,
          event_date, start_time, end_time, purpose, client_request_id
        ) values (
          ${orgId}, ${roomId}, ${requester.user_id}, ${eventName}, ${participantCount},
          ${eventDate}, ${startTime}, ${endTime}, ${purpose}, ${clientRequestId}
        )
        returning booking_id
      `;
      if (Object.keys(fullFormData).length > 0) {
        await sql`
          insert into activity_application (booking_id, org_id, applicant_user_id, form_data, status, submitted_at)
          values (${booking.booking_id}, ${Number(orgId)}, ${Number(requester.user_id)}, ${JSON.stringify(fullFormData)}::jsonb, 'Submitted', now())
          on conflict (booking_id) do update set
            org_id = excluded.org_id,
            applicant_user_id = excluded.applicant_user_id,
            form_data = excluded.form_data,
            status = 'Submitted',
            updated_at = now(),
            submitted_at = now()
        `;
      }
      if (attachment?.data && attachment.name) {
        await sql`
          insert into document (booking_id, file_name, file_path, content_type)
          values (${booking.booking_id}, ${attachment.name}, ${attachment.data}, ${attachment.type ?? "application/octet-stream"})
        `;
      }
      for (const item of equipment) {
        const request = typeof item === "string"
          ? (() => {
              const match = item.match(/^(.*?) × (\d+)$/);
              return match ? { name: match[1], quantity: Number(match[2]) } : null;
            })()
          : { equipmentId: Number(item.equipmentId), quantity: Number(item.quantity) };
        if (!request) continue;
        await sql`
          insert into booking_equipment (booking_id, equipment_id, quantity_requested)
          select ${booking.booking_id}, equipment_id, ${request.quantity}
          from equipment
          where ${"equipmentId" in request ? sql`equipment_id = ${request.equipmentId}` : sql`equipment_name = ${request.name}`}
        `;
      }
      await createBookingNotifications(Number(booking.booking_id), "Faculty review", "organization");
      response.status(201).json({ created: true, bookingId: booking.booking_id });
      return;
    }

    if (request.method === "PATCH") {
      const bookingId = Number(request.query.id);
      const { status, userId, remarks } = request.body ?? {};
      if (!Number.isInteger(bookingId) || !status || !userId) {
        response.status(400).json({ error: "Invalid status update" });
        return;
      }
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
      await sql`
        update booking
        set status = ${status},
            rejection_reason = ${status === "Rejected" ? remarks ?? "No reason provided" : null}
        where booking_id = ${bookingId}
      `;
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
      response.json({ updated: true });
      return;
    }

    response.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Database operation failed";
    response.status(409).json({ error: message });
  }
}
