import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { query, queryOne } from "@/lib/db"

export const runtime = "nodejs"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    if (user.role !== "engineer" && user.role !== "admin" && user.role !== "superadmin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id } = await params
    const body = await req.json().catch(() => ({}))

    const assignee = body.assignee ?? user.id
    const status = body.status ?? "open"
    const assignedAt = body.assigned_at ?? new Date().toISOString()
    const slaResolutionAt =
      body.sla_resolution_at ??
      new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString()

    // Atomic claim: only succeeds if the ticket is still unassigned
    const claimed = await queryOne<{ id: string }>(
      `UPDATE tickets
         SET assignee = $2,
             status = $3,
             assigned_at = $4,
             sla_resolution_at = $5
       WHERE id = $1 AND assignee IS NULL
       RETURNING id`,
      [id, assignee, status, assignedAt, slaResolutionAt]
    )

    if (!claimed) {
      return NextResponse.json({ error: "Ticket already acquired" }, { status: 409 })
    }

    await query(
      "INSERT INTO ticket_activity (ticket_id, actor_id, action, details) VALUES ($1,$2,'acquired','{}')",
      [id, assignee]
    )

    return NextResponse.json({ success: true, ticket_id: id })
  } catch (err) {
    console.error("Ticket acquire failed:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
