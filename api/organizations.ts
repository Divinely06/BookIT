import { neon } from "@neondatabase/serverless";
import type { Request, Response } from "express";

const sql = neon(process.env.DATABASE_URL!);

export default async function handler(request: Request, response: Response) {
  if (request.method === "PATCH") {
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
    return;
  }

  if (request.method !== "POST") {
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { name, email, password, facultyAdviser } = request.body ?? {};

  if (!name || !email || !password) {
    response.status(400).json({
      error: "Organization name, email, and password are required",
    });
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
      values (${name}, ${adviser?.user_id ?? null}, ${email}, 'Active')
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
}
