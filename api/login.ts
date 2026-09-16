import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { email, password } = req.body ?? {};
  if (typeof email !== "string" || typeof password !== "string") {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    res.status(503).json({ error: "Database is not configured" });
    return;
  }

  try {
    const sql = neon(connectionString);
    const rows = await sql`
      select
        u.user_id,
        u.full_name,
        u.email,
        u.role,
        u.password_hash,
        o.org_id as organization_id
      from app_user u
      left join student_organization o
        on lower(o.contact_email) = lower(u.email)
      where lower(u.email) = lower(${email.trim()})
        and (o.org_id is null or o.status = 'Active')
      limit 1
    `;
    const user = rows[0];

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    res.status(200).json({
      userId: user.user_id,
      name: user.full_name,
      email: user.email,
      role: user.role,
      organizationId: user.organization_id ?? null,
    });
  } catch (error) {
    console.error("Login failed", error);
    res.status(500).json({ error: "Unable to sign in right now" });
  }
}