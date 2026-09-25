import express from "express";
import bcrypt from "bcryptjs";
import { sql } from "./db.js";

const app = express();
const port = Number(process.env.PORT ?? 3001);

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

app.use(express.json({ limit: "15mb" }));
app.use((_request, response, next) => {
  response.header("Access-Control-Allow-Origin", "http://localhost:5173");
  response.header("Access-Control-Allow-Headers", "Content-Type");
  response.header("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");
  if (_request.method === "OPTIONS") {
    response.sendStatus(204);
    return;
  }
  next();
});

app.get("/api/health", async (_request, response) => {
  try {
    await sql`select 1 as connected`;
    response.json({ database: "connected" });
  } catch {
    response.status(500).json({ database: "unavailable" });
  }
});

const validActivityForm = (formData: Record<string, unknown>) => {
  const missionAlignment = formData.missionAlignment;
  return Boolean(
    formData.category &&
      formData.size &&
      formData.applicantName &&
      formData.studentNumber &&
      formData.programYear &&
      formData.position &&
      formData.nature &&
      formData.objectives &&
      Array.isArray(missionAlignment) &&
      missionAlignment.length > 0,
  );
};

const validProposalForm = (formData: Record<string, unknown>, submitting: boolean) => {
  const objectives = formData.objectives;
  const date = String(formData.eventDate ?? "");
  const startTime = String(formData.startTime ?? "");
  const endTime = String(formData.endTime ?? "");
  const dateValue = new Date(`${date}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Boolean(
    formData.school && formData.academicYear && formData.eventTitle &&
      date && startTime && endTime && formData.venue && formData.mode &&
      formData.description && Array.isArray(objectives) && objectives.length > 0 &&
      Number(formData.expectedCount) > 0 &&
      /^\d{4}-\d{2}-\d{2}$/.test(date) &&
      /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(startTime) &&
      /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(endTime) &&
      startTime < endTime && (!submitting || dateValue >= today)
  );
};

app.get("/api/event-proposals", async (request, response) => {
  const userId = Number(request.query.userId);
  const orgId = Number(request.query.orgId);
  if (!Number.isInteger(userId) || !Number.isInteger(orgId)) {
    response.status(400).json({ error: "A valid user and organization are required" });
    return;
  }
  try {
    const proposals = await sql`
      select proposal_id, activity_id, org_id, created_by_user_id, form_data,
        status, rejection_reason, created_at, updated_at, submitted_at
      from event_proposal
      where org_id = ${orgId}
      order by updated_at desc
    `;
    response.json(proposals);
  } catch {
    response.status(500).json({ error: "Unable to load event proposals" });
  }
});

app.post("/api/event-proposals", async (request, response) => {
  const { proposalId, activityId, orgId, userId, formData, submit = false } = request.body ?? {};
  if (!Number.isInteger(Number(orgId)) || !Number.isInteger(Number(userId))
    || !formData || typeof formData !== "object" || Array.isArray(formData)) {
    response.status(400).json({ error: "Invalid event proposal" });
    return;
  }
  if (submit && !validProposalForm(formData as Record<string, unknown>, true)) {
    response.status(400).json({ error: "Complete the required proposal fields" });
    return;
  }
  try {
    const [membership] = await sql`
      select 1 from user_organization
      where user_id = ${Number(userId)} and org_id = ${Number(orgId)} and status = 'Active'
    `;
    if (!membership) {
      response.status(403).json({ error: "You are not a member of this organization" });
      return;
    }
    if (proposalId) {
      const [proposal] = await sql`
        update event_proposal
        set form_data = ${JSON.stringify(formData)}::jsonb,
            updated_at = now(),
            status = case when status = 'Rejected' then 'Draft' else status end,
            rejection_reason = null,
            submitted_at = case when ${Boolean(submit)} then now() else submitted_at end
        where proposal_id = ${Number(proposalId)} and org_id = ${Number(orgId)}
          and created_by_user_id = ${Number(userId)}
        returning proposal_id, activity_id, status, updated_at
      `;
      response.status(200).json(proposal);
      return;
    }
    const [activity] = await sql`
      insert into activity (org_id, created_by_user_id)
      values (${Number(orgId)}, ${Number(userId)})
      returning activity_id
    `;
    const [proposal] = await sql`
      insert into event_proposal
        (activity_id, org_id, created_by_user_id, form_data, status, submitted_at)
      values (
        ${activity.activity_id}, ${Number(orgId)}, ${Number(userId)},
        ${JSON.stringify(formData)}::jsonb, ${submit ? "Submitted" : "Draft"},
        ${submit ? sql`now()` : sql`null`}
      )
      returning proposal_id, activity_id, status, updated_at
    `;
    response.status(201).json(proposal);
  } catch {
    response.status(409).json({ error: "Unable to save event proposal" });
  }
});

app.patch("/api/event-proposals/:id/status", async (request, response) => {
  const proposalId = Number(request.params.id);
  const { userId, status, remarks } = request.body ?? {};
  if (!Number.isInteger(proposalId) || !Number.isInteger(Number(userId))
    || !["Adviser Noted", "Approved", "Rejected"].includes(String(status))) {
    response.status(400).json({ error: "Invalid proposal status update" });
    return;
  }
  try {
    const [proposal] = await sql`
      select p.status, p.org_id, o.faculty_adviser_id, u.role
      from event_proposal p
      join student_organization o on o.org_id = p.org_id
      join app_user u on u.user_id = ${Number(userId)}
      where p.proposal_id = ${proposalId}
    `;
    const isAdviser = proposal?.role === "faculty" && proposal.faculty_adviser_id === Number(userId)
      && proposal.status === "Submitted" && ["Adviser Noted", "Rejected"].includes(String(status));
    const isFinal = proposal?.role === "admin" && proposal.status === "Adviser Noted"
      && ["Approved", "Rejected"].includes(String(status));
    if (!proposal || (!isAdviser && !isFinal)) {
      response.status(403).json({ error: "You are not authorized for this proposal stage" });
      return;
    }
    const stage = isAdviser ? "Adviser" : "Final";
    await sql`
      update event_proposal
      set status = ${String(status)},
          rejection_reason = ${status === "Rejected" ? remarks ?? "No reason provided" : null},
          updated_at = now()
      where proposal_id = ${proposalId}
    `;
    await sql`
      insert into event_proposal_approval
        (proposal_id, approved_user_id, approval_stage, status, remarks)
      values (${proposalId}, ${Number(userId)}, ${stage},
        ${status === "Rejected" ? "Rejected" : stage === "Adviser" ? "Noted" : "Approved"},
        ${remarks ?? null})
      on conflict (proposal_id, approval_stage) do update set
        approved_user_id = excluded.approved_user_id,
        status = excluded.status,
        date_actioned = now(),
        remarks = excluded.remarks
    `;
    response.json({ updated: true });
  } catch {
    response.status(500).json({ error: "Unable to update proposal status" });
  }
});

app.get("/api/activity-applications", async (request, response) => {
  const userId = Number(request.query.userId);
  const orgId = Number(request.query.orgId);
  if (!Number.isInteger(userId) || !Number.isInteger(orgId)) {
    response.status(400).json({ error: "A valid user and organization are required" });
    return;
  }
  try {
    const [application] = await sql`
      select application_id, booking_id, org_id, applicant_user_id, form_data,
        status, rejection_reason, created_at, updated_at, submitted_at
      from activity_application
      where org_id = ${orgId} and applicant_user_id = ${userId}
      order by updated_at desc
      limit 1
    `;
    response.json(application ?? null);
  } catch {
    response.status(500).json({ error: "Unable to load the activity application" });
  }
});

app.post("/api/activity-applications", async (request, response) => {
  const { applicationId, orgId, applicantUserId, formData } = request.body ?? {};
  if (!Number.isInteger(Number(orgId)) || !Number.isInteger(Number(applicantUserId))
    || !formData || typeof formData !== "object" || Array.isArray(formData)) {
    response.status(400).json({ error: "Invalid activity application" });
    return;
  }
  try {
    const [membership] = await sql`
      select 1 from user_organization
      where user_id = ${Number(applicantUserId)} and org_id = ${Number(orgId)}
        and status = 'Active'
    `;
    if (!membership) {
      response.status(403).json({ error: "You are not a member of this organization" });
      return;
    }
    const [application] = applicationId
      ? await sql`
          update activity_application
          set form_data = ${JSON.stringify(formData)}::jsonb,
              updated_at = now(),
              status = case when status = 'Rejected' then 'Draft' else status end,
              rejection_reason = null
          where application_id = ${Number(applicationId)}
            and org_id = ${Number(orgId)}
            and applicant_user_id = ${Number(applicantUserId)}
          returning application_id, status, updated_at
        `
      : await sql`
          insert into activity_application (org_id, applicant_user_id, form_data)
          values (${Number(orgId)}, ${Number(applicantUserId)}, ${JSON.stringify(formData)}::jsonb)
          returning application_id, status, updated_at
        `;
    response.status(201).json(application);
  } catch {
    response.status(409).json({ error: "Unable to save the activity application" });
  }
});

app.post(["/api/auth", "/api/login"], async (request, response) => {
  const { email, password } = request.body ?? {};
  if (!email || !password) {
    response.status(400).json({ error: "Email and password are required" });
    return;
  }

  try {
    const [user] = await sql`
      select u.user_id, u.full_name, u.email, u.role, u.password_hash, o.org_id, o.org_name
      from app_user u
      left join user_organization membership on membership.user_id = u.user_id
        and membership.status = 'Active'
      left join student_organization o on o.org_id = membership.org_id
        and lower(o.contact_email) = lower(u.email)
      where lower(u.email) = lower(${email})
        and (o.org_id is null or o.status = 'Active')
      limit 1
    `;
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      response.status(401).json({ error: "Invalid email or password" });
      return;
    }
    if (user.role === "organization" && !user.org_id) {
      response.status(409).json({
        error: "This organization account is not linked to an organization yet",
      });
      return;
    }
    response.json({
      userId: user.user_id,
      name: user.full_name,
      email: user.email,
      role: user.role,
      organizationId: user.org_id ?? null,
      organizationName: user.org_name ?? null,
    });
  } catch {
    response.status(500).json({ error: "Unable to sign in" });
  }
});

app.get("/api/bookings", async (request, response) => {
  try {
    const userId = Number(request.query.userId);
    const role = String(request.query.role ?? "");
    if (!["organization", "faculty", "dean", "admin", "cdmo"].includes(role) || !userId) {
      response.status(401).json({ error: "A valid user identity is required" });
      return;
    }
    const bookings = await sql`
      select
        b.booking_id,
        b.org_id,
        o.org_name,
        b.room_id,
        r.room_name,
        b.requested_by_user_id,
        b.event_name,
        b.participant_count,
        b.date_requested,
        to_char(b.event_date, 'YYYY-MM-DD') as event_date,
        to_char(b.start_time, 'HH24:MI') as start_time,
        to_char(b.end_time, 'HH24:MI') as end_time,
        b.purpose,
        b.rejection_reason,
        b.status,
        coalesce((
          select aa.form_data
          from activity_application aa
          where aa.booking_id = b.booking_id
          order by aa.updated_at desc
          limit 1
        ), '{}'::jsonb) as activity_application,
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
        (${role} = 'faculty' and o.faculty_adviser_id = ${userId})
        or (${role} = 'organization' and exists (
          select 1 from user_organization membership
          where membership.user_id = ${userId}
            and membership.org_id = o.org_id and membership.status = 'Active'
        ))
        or ${role} in ('dean', 'admin', 'cdmo')
      )
      order by b.date_requested desc
    `;
    response.json(bookings);
  } catch {
    response.status(500).json({ error: "Unable to load bookings" });
  }
});

app.get("/api/notifications", async (request, response) => {
  const userId = Number(request.query.userId);
  if (!Number.isInteger(userId) || userId < 1) {
    response.status(400).json({ error: "User identity is required" });
    return;
  }
  try {
    const notifications = await sql`
      select notification_id, booking_id, title, message, is_read, created_at
      from notification
      where user_id = ${userId}
      order by created_at desc
      limit 30
    `;
    response.json(notifications);
  } catch {
    response.status(500).json({ error: "Unable to load notifications" });
  }
});

app.patch(["/api/notifications", "/api/notifications/:id/read"], async (request, response) => {
  const notificationId = Number(request.query.id ?? request.params.id);
  const userId = Number(request.body?.userId);
  if (!Number.isInteger(notificationId) || !Number.isInteger(userId) || userId < 1) {
    response.status(400).json({ error: "Invalid notification update" });
    return;
  }
  try {
    await sql`
      update notification
      set is_read = true
      where notification_id = ${notificationId} and user_id = ${userId}
    `;
    response.json({ updated: true });
  } catch {
    response.status(500).json({ error: "Unable to update notification" });
  }
});

app.get("/api/resources", async (request, response) => {
  try {
    const requestedDate = typeof request.query.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(request.query.date)
      ? request.query.date
      : null;
    const startTime = typeof request.query.startTime === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(request.query.startTime)
      ? request.query.startTime
      : "00:00";
    const endTime = typeof request.query.endTime === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(request.query.endTime)
      ? request.query.endTime
      : "23:59";
    const [rooms, equipment, organizations] = await Promise.all([
      sql`
        select r.room_id, r.room_name, r.location, r.capacity, r.availability_status,
          ${requestedDate ? sql`r.availability_status = 'Available' and not exists (
            select 1 from booking b
            where b.room_id = r.room_id
              and b.event_date = ${requestedDate}::date
              and b.status <> 'Rejected'
              and (${requestedDate}::date + ${startTime}::time, ${requestedDate}::date + ${endTime}::time)
                overlaps (b.event_date + b.start_time, b.event_date + b.end_time)
          )` : sql`true`} as date_available
        from room r order by r.room_name
      `,
      sql`
        select e.equipment_id, e.equipment_name, e.category, e.quantity_available, e.status,
          case when e.status <> 'Available' then 0 else greatest(0, e.quantity_available - coalesce((
            select sum(be.quantity_requested)
            from booking_equipment be
            join booking b on b.booking_id = be.booking_id
            where be.equipment_id = e.equipment_id
              and b.event_date = ${requestedDate ?? "9999-12-31"}::date
              and b.status <> 'Rejected'
              and (${requestedDate ?? "9999-12-31"}::date + ${startTime}::time, ${requestedDate ?? "9999-12-31"}::date + ${endTime}::time)
                overlaps (b.event_date + b.start_time, b.event_date + b.end_time)
          ), 0)) end as date_available
        from equipment e order by e.equipment_name
      `,
      sql`
        select
          o.org_id,
          o.org_name,
          o.contact_email,
          o.status,
          adviser.full_name as faculty_adviser
        from student_organization o
        left join app_user adviser on adviser.user_id = o.faculty_adviser_id
        order by o.org_name
      `,
    ]);

    response.json({ rooms, equipment, organizations });
  } catch {
    response.status(500).json({ error: "Unable to load resources" });
  }
});

app.patch("/api/resources", async (request, response) => {
  const { type, id, name, location, capacity, availabilityStatus, quantityAvailable, status, category } = request.body ?? {};
  if (!Number.isInteger(Number(id)) || !["room", "equipment"].includes(type)) {
    response.status(400).json({ error: "A valid resource type and ID are required" });
    return;
  }
  try {
    if (type === "room") {
      const [room] = await sql`
        update room
        set room_name = coalesce(${name ?? null}, room_name),
            location = coalesce(${location ?? null}, location),
            capacity = coalesce(${capacity ? Number(capacity) : null}, capacity),
            availability_status = coalesce(${availabilityStatus ?? null}, availability_status)
        where room_id = ${Number(id)}
        returning room_id, room_name, location, capacity, availability_status
      `;
      if (!room) {
        response.status(404).json({ error: "Facility not found" });
        return;
      }
      response.json(room);
      return;
    }
    const [item] = await sql`
      update equipment
      set equipment_name = coalesce(${name ?? null}, equipment_name),
          category = coalesce(${category ?? null}, category),
          quantity_available = coalesce(${quantityAvailable === undefined ? null : Number(quantityAvailable)}, quantity_available),
          status = coalesce(${status ?? null}, status)
      where equipment_id = ${Number(id)}
      returning equipment_id, equipment_name, category, quantity_available, status
    `;
    if (!item) {
      response.status(404).json({ error: "Equipment not found" });
      return;
    }
    response.json(item);
  } catch {
    response.status(409).json({ error: "Unable to update resource" });
  }
});

app.post("/api/resources", async (request, response) => {
  const { type, name, location, capacity, category, quantityAvailable } = request.body ?? {};
  if (!["room", "equipment"].includes(type) || typeof name !== "string" || !name.trim()) {
    response.status(400).json({ error: "Resource type and name are required" });
    return;
  }
  try {
    if (type === "room") {
      const [room] = await sql`
        insert into room (room_name, location, capacity, availability_status)
        values (${name.trim()}, ${String(location ?? "To be assigned")}, ${Number(capacity) > 0 ? Number(capacity) : 1}, 'Available')
        returning room_id, room_name, location, capacity, availability_status
      `;
      response.status(201).json(room);
      return;
    }
    const [item] = await sql`
      insert into equipment (equipment_name, category, quantity_available, status)
      values (${name.trim()}, ${String(category ?? "General")}, ${Math.max(0, Number(quantityAvailable) || 0)}, 'Available')
      returning equipment_id, equipment_name, category, quantity_available, status
    `;
    response.status(201).json(item);
  } catch {
    response.status(409).json({ error: "Unable to add resource. The name may already exist." });
  }
});

app.post("/api/organizations", async (request, response) => {
  const { name, email, password, facultyAdviser } = request.body;

  if (!name || !email || !password) {
    response.status(400).json({ error: "Organization name, email, and password are required" });
    return;
  }

  try {
    const [adviser] = await sql`
      select user_id
      from app_user
      where full_name = ${facultyAdviser ?? "Prof. Maria Santos"}
        and role = 'faculty'
      limit 1
    `;
    const [user] = await sql`
      insert into app_user (full_name, email, password_hash, role)
      values (${name}, ${email}, crypt(${password}, gen_salt('bf')), 'organization')
      returning user_id
    `;
    const [organization] = await sql`
      insert into student_organization (
        org_name, faculty_adviser_id, contact_email, status
      )
      values (
        ${name}, ${adviser?.user_id ?? null}, ${email}, 'Active'
      )
      returning org_id, org_name, contact_email, status
    `;
    await sql`
      insert into user_organization (user_id, org_id, membership_role)
      values (${user.user_id}, ${organization.org_id}, 'Requester')
    `;
    response.status(201).json(organization);
  } catch {
    response.status(409).json({ error: "Unable to create organization account" });
  }
});

app.patch("/api/organizations", async (request, response) => {
  const { orgId, facultyAdviser, password, status } = request.body ?? {};
  if (!orgId || (!facultyAdviser && !password && !status)) {
    response.status(400).json({ error: "Organization and an update are required" });
    return;
  }
  if (password !== undefined && (typeof password !== "string" || password.length < 4)) {
    response.status(400).json({ error: "Password must be at least 4 characters" });
    return;
  }
  try {
    const [adviser] = facultyAdviser ? await sql`
      select user_id from app_user
      where full_name = ${facultyAdviser} and role = 'faculty'
    ` : [null];
    if (facultyAdviser && !adviser) {
      response.status(404).json({ error: "Faculty adviser not found" });
      return;
    }
    const [organization] = await sql`
      update student_organization
      set faculty_adviser_id = coalesce(${adviser?.user_id ?? null}, faculty_adviser_id),
          status = coalesce(${status ?? null}, status)
      where org_id = ${orgId}
      returning org_id, org_name, contact_email, status, faculty_adviser_id
    `;
    if (!organization) {
      response.status(404).json({ error: "Organization not found" });
      return;
    }
    if (password) {
      const [account] = await sql`
        update app_user
        set password_hash = crypt(${password}, gen_salt('bf'))
        where lower(email) = lower(${organization.contact_email})
          and role = 'organization'
        returning user_id
      `;
      if (!account) {
        response.status(404).json({ error: "Organization login account not found" });
        return;
      }
    }
    response.json(organization);
  } catch {
    response.status(409).json({ error: "Unable to update faculty adviser" });
  }
});

app.post("/api/bookings", async (request, response) => {
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
    activityApplication,
    clientRequestId,
    attachment,
    equipment = [],
  } = request.body;

  if (!clientRequestId) {
    response.status(400).json({ error: "Booking request ID is required" });
    return;
  }
      if (activityApplication) {
        if (typeof activityApplication !== "object" || Array.isArray(activityApplication)
          || !validActivityForm(activityApplication as Record<string, unknown>)) {
          response.status(400).json({ error: "Complete the required Form 1 fields" });
          return;
        }
        const minimumDate = new Date();
        minimumDate.setHours(0, 0, 0, 0);
        minimumDate.setDate(minimumDate.getDate() + 10);
        const activityDate = new Date(`${eventDate}T00:00:00`);
        if (Number.isNaN(activityDate.getTime()) || activityDate < minimumDate) {
          response.status(400).json({ error: "Form 1 must be submitted at least 10 days before the activity" });
          return;
        }
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
  if (!orgId || !roomId || !eventName || !participantCount || !eventDate || !startTime || !endTime || !purpose) {
    response.status(400).json({ error: "Missing required booking fields" });
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

  const requester = requestedByUserId
    ? await sql`
        select u.user_id from app_user u
        join user_organization membership on membership.user_id = u.user_id
          and membership.org_id = ${orgId} and membership.status = 'Active'
        join student_organization organization on organization.org_id = membership.org_id
          and organization.status = 'Active'
        where u.user_id = ${requestedByUserId} and u.role = 'organization'
      `
    : await sql`
        select u.user_id
        from app_user u
        join student_organization o on o.contact_email = u.email
        where o.org_id = ${orgId} and o.status = 'Active' and u.role = 'organization'
        limit 1
      `;
  const resolvedRequesterId = requester[0]?.user_id;

  if (
    !orgId ||
    !roomId ||
    !resolvedRequesterId ||
    !eventName ||
    !participantCount ||
    !eventDate ||
    !startTime ||
    !endTime ||
    !purpose
  ) {
    response.status(400).json({ error: "Missing required booking fields" });
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

  try {
    const [booking] = await sql`
      insert into booking (
        org_id,
        room_id,
        requested_by_user_id,
        event_name,
        participant_count,
        event_date,
        start_time,
        end_time,
        purpose,
        client_request_id
      )
      values (
        ${orgId},
        ${roomId},
        ${resolvedRequesterId},
        ${eventName},
        ${participantCount},
        ${eventDate},
        ${startTime},
        ${endTime},
        ${purpose},
        ${clientRequestId}
      )
      returning booking_id
    `;

    if (attachment?.data && attachment.name) {
      await sql`
        insert into document (booking_id, file_name, file_path, content_type)
        values (${booking.booking_id}, ${attachment.name}, ${attachment.data}, ${attachment.type ?? "application/octet-stream"})
      `;
    }
      if (activityApplication) {
        await sql`
          insert into activity_application
            (booking_id, org_id, applicant_user_id, form_data, status, submitted_at)
          values (
            ${booking.booking_id}, ${orgId}, ${resolvedRequesterId},
            ${JSON.stringify(activityApplication)}::jsonb, 'Submitted', now()
          )
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
    response.status(201).json(booking);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Booking failed";
    response.status(409).json({ error: message });
  }
});

app.patch("/api/bookings/:id/status", async (request, response) => {
  const bookingId = Number(request.params.id);
  const { status, userId, remarks } = request.body;

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

    const approvalLevelByRole: Record<string, number> = {
      faculty: 1,
      dean: 2,
      admin_review: 2,
      cdmo: 3,
      final_admin: 4,
    };
    if (approvalLevelByRole[workflowRole]) {
      await sql`
        insert into approval (
          booking_id, approved_user_id, approval_level, status, date_actioned, remarks
        )
        values (
          ${bookingId}, ${userId}, ${approvalLevelByRole[workflowRole]}, ${status === "Rejected" ? "Rejected" : "Approved"}, now(), ${remarks ?? null}
        )
        on conflict (booking_id, approval_level)
        do update set
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
});

app.listen(port, "0.0.0.0", () => {
  console.log(`API running on http://localhost:${port}`);
});
