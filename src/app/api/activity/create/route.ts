import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { query } from "@/lib/db"

export const runtime = "nodejs"

export async function POST(req: Request) {
  try {
    const user = await requireAuth(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { ticket_id, actor_id, action, details } = await req.json()

    if (!ticket_id || !actor_id || !action) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 })
    }

    await query(
      "INSERT INTO ticket_activity (ticket_id, actor_id, action, details) VALUES ($1, $2, $3, $4)",
      [ticket_id, actor_id, action, JSON.stringify(details ?? {})]
    )

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Activity create failed:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
