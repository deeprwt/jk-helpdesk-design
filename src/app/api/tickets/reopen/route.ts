import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { query, queryOne } from "@/lib/db"
import { sendTicketEmail } from "@/lib/email"

export const runtime = "nodejs"

export async function POST(req: Request) {
  try {
    const user = await requireAuth(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { ticket_id } = await req.json()
    if (!ticket_id) return NextResponse.json({ error: "Missing ticket_id" }, { status: 400 })

    const ticket = await queryOne<{
      id: string; status: string; assignee: string | null; requester_id: string; subject: string
      hold_started_at: string | null; sla_resolution_at: string | null; sla_paused_ms: number
    }>(
      "SELECT id, status, assignee, requester_id, subject, hold_started_at, sla_resolution_at, sla_paused_ms FROM tickets WHERE id=$1",
      [ticket_id]
    )

    if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 })

    if (ticket.status === "hold" && ticket.hold_started_at) {
      const pausedMs = Date.now() - new Date(ticket.hold_started_at).getTime()
      const totalPausedMs = (ticket.sla_paused_ms ?? 0) + pausedMs
      const newSla = ticket.sla_resolution_at
        ? new Date(new Date(ticket.sla_resolution_at).getTime() + pausedMs).toISOString()
        : null

      await query(
        `UPDATE tickets SET status='open', hold_comment=NULL, hold_duration_hours=NULL,
         hold_started_at=NULL, hold_until=NULL, sla_paused_ms=$1, sla_resolution_at=$2,
         sla_resolution_breached=false WHERE id=$3`,
        [totalPausedMs, newSla, ticket_id]
      )
    } else {
      const newSla = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString()
      await query(
        `UPDATE tickets SET status='open', closed_comment=NULL, hold_comment=NULL,
         hold_duration_hours=NULL, hold_started_at=NULL, hold_until=NULL,
         sla_resolution_at=$1, sla_resolution_breached=false WHERE id=$2`,
        [newSla, ticket_id]
      )
    }

    const engineerData = await queryOne<{ full_name: string }>(
      "SELECT full_name FROM users WHERE id=$1", [user.id]
    )

    await query(
      "INSERT INTO ticket_activity (ticket_id, actor_id, action, details) VALUES ($1,$2,'reopened',$3)",
      [ticket_id, user.id, JSON.stringify({
        previous_status: ticket.status,
        engineer_name: engineerData?.full_name ?? "Engineer",
      })]
    )

    const ticketShortId = ticket_id.slice(0, 8).toUpperCase()
    const actorName = engineerData?.full_name ?? "Support Engineer"

    const requester = await queryOne<{ full_name: string; email: string }>(
      "SELECT full_name, email FROM users WHERE id=$1", [ticket.requester_id]
    )

    if (ticket.requester_id !== user.id) {
      await query(
        "INSERT INTO notifications (user_id, actor_id, ticket_id, type, message, is_read) VALUES ($1,$2,$3,'status_changed',$4,false)",
        [ticket.requester_id, user.id, ticket_id, `reopened your ticket #${ticketShortId}`]
      )
    }

    if (requester?.email) {
      sendTicketEmail({ to: requester.email, recipientName: requester.full_name ?? "User",
        actorName, ticketId: ticket_id, ticketSubject: ticket.subject, action: "reopened" }).catch(() => {})
    }

    const admins = await query<{ id: string; full_name: string; email: string }>(
      "SELECT id, full_name, email FROM users WHERE role IN ('admin','superadmin')"
    )

    for (const admin of admins) {
      if (admin.id === user.id) continue
      await query(
        "INSERT INTO notifications (user_id, actor_id, ticket_id, type, message, is_read) VALUES ($1,$2,$3,'status_changed',$4,false)",
        [admin.id, user.id, ticket_id, `reopened ticket #${ticketShortId}`]
      )
      if (admin.email) {
        sendTicketEmail({ to: admin.email, recipientName: admin.full_name ?? "Admin",
          actorName, ticketId: ticket_id, ticketSubject: ticket.subject, action: "reopened" }).catch(() => {})
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Reopen failed:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
