import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { sql } from "./_db.js";

export default async function handler(request: Request, response: Response) {
  if (request.method !== "POST") {
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { email, password } = request.body ?? {};
  if (!email || !password) {
    response.status(400).json({ error: "Email and password are required" });
    return;
  }

  try {
    const [user] = await sql`
      select
        u.user_id,
        u.full_name,
        u.role,
        u.password_hash,
        o.org_id,
        o.org_name
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
      role: user.role,
      organizationId: user.org_id ?? null,
      name: user.full_name,
      organizationName: user.org_name ?? null,
    });
  } catch {
    response.status(500).json({ error: "Unable to sign in" });
  }
}
