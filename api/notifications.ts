import type { Request, Response } from "express";
import { sql } from "./_db.js";

export default async function handler(request: Request, response: Response) {
  const userId = Number(request.query.userId ?? request.body?.userId);
  if (!Number.isInteger(userId) || userId < 1) {
    response.status(400).json({ error: "User identity is required" });
    return;
  }

  try {
    if (request.method === "GET") {
      const notifications = await sql`
        select notification_id, booking_id, title, message, is_read, created_at
        from notification
        where user_id = ${userId}
        order by created_at desc
        limit 30
      `;
      response.json(notifications);
      return;
    }

    if (request.method === "PATCH") {
      const notificationId = Number(request.query.id);
      if (!Number.isInteger(notificationId)) {
        response.status(400).json({ error: "Invalid notification update" });
        return;
      }
      await sql`
        update notification
        set is_read = true
        where notification_id = ${notificationId} and user_id = ${userId}
      `;
      response.json({ updated: true });
      return;
    }

    response.status(405).json({ error: "Method not allowed" });
  } catch {
    response.status(500).json({ error: "Unable to process notifications" });
  }
}