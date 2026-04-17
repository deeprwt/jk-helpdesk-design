import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { query } from "@/lib/db"

export const runtime = "nodejs"

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params

    const activity = await query(
      `SELECT a.*, u.full_name AS actor_name, u.avatar_url AS actor_avatar
       FROM ticket_activity a
       LEFT JOIN users u ON u.id = a.actor_id
       WHERE a.ticket_id = $1
       ORDER BY a.created_at ASC`,
      [id]
    )

    return NextResponse.json({ activity })
  } catch (err) {
    console.error("Activity fetch failed:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
