import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { query } from "@/lib/db"

export const runtime = "nodejs"

export async function GET(req: Request) {
  try {
    const user = await requireAuth(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const notifications = await query<{
      id: string; ticket_id: string; message: string; type: string
      is_read: boolean; created_at: string; actor_id: string
      actor_full_name: string | null; actor_avatar_url: string | null
    }>(
      `SELECT n.id, n.ticket_id, n.message, n.type, n.is_read, n.created_at, n.actor_id,
              u.full_name AS actor_full_name, u.avatar_url AS actor_avatar_url
       FROM notifications n
       LEFT JOIN users u ON u.id = n.actor_id
       WHERE n.user_id = $1
       ORDER BY n.created_at DESC
       LIMIT 50`,
      [user.id]
    )

    const rows = notifications.map((n) => ({
      id: n.id,
      ticket_id: n.ticket_id,
      message: n.message,
      type: n.type,
      is_read: n.is_read,
      created_at: n.created_at,
      actor_id: n.actor_id,
      actor: n.actor_full_name
        ? { full_name: n.actor_full_name, avatar_url: n.actor_avatar_url }
        : null,
    }))

    return NextResponse.json({ notifications: rows })
  } catch (err) {
    console.error("Notifications fetch failed:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
