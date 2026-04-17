import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { query, queryOne } from "@/lib/db"

export const runtime = "nodejs"

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params

    const ticket = await queryOne(
      `SELECT t.*,
              u.full_name AS requester_full_name, u.email AS requester_email, u.avatar_url AS requester_avatar,
              a.full_name AS assignee_full_name, a.email AS assignee_email, a.avatar_url AS assignee_avatar
       FROM tickets t
       LEFT JOIN users u ON u.id = t.requester_id
       LEFT JOIN users a ON a.id = t.assignee
       WHERE t.id = $1`,
      [id]
    )

    if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 })

    /* Attachments */
    const attachments = await query(
      "SELECT id, file_name, file_path, file_type, file_size, created_at FROM ticket_attachments WHERE ticket_id=$1 ORDER BY created_at",
      [id]
    )

    return NextResponse.json({ ticket: { ...ticket, attachments } })
  } catch (err) {
    console.error("Ticket fetch failed:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const body = await req.json()

    const allowed = [
      "status", "assignee", "assigned_at", "priority", "category", "sub_category",
      "closed_comment", "hold_comment", "hold_duration_hours", "hold_started_at",
      "hold_until", "sla_resolution_at", "sla_resolution_breached", "sla_response_breached",
    ]

    const updates = Object.entries(body).filter(([k]) => allowed.includes(k))
    if (updates.length === 0) return NextResponse.json({ error: "No valid fields" }, { status: 400 })

    const setClauses = updates.map(([k], i) => `${k} = $${i + 2}`).join(", ")
    const values = [id, ...updates.map(([, v]) => v)]

    await query(`UPDATE tickets SET ${setClauses} WHERE id = $1`, values)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Ticket update failed:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
