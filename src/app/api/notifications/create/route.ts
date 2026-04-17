import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { query } from "@/lib/db"

export const runtime = "nodejs"

export async function POST(req: Request) {
  try {
    const user = await requireAuth(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { user_id, actor_id, ticket_id, type, message } = await req.json()

    if (!user_id || !actor_id || !ticket_id || !type || !message) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    if (user_id === actor_id) return NextResponse.json({ skipped: true })

    await query(
      "INSERT INTO notifications (user_id, actor_id, ticket_id, type, message, is_read) VALUES ($1, $2, $3, $4, $5, false)",
      [user_id, actor_id, ticket_id, type, message]
    )

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Notification create failed:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
