import { NextResponse } from "next/server"
import { query } from "@/lib/db"
import { sendTicketEmail } from "@/lib/email"

export const runtime = "nodejs"

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const key = searchParams.get("key")
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && key !== cronSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const now = new Date()
    const results = { admin_alerts: 0, response_breaches: 0, resolution_breaches: 0 }

    /* ── 1. 10-min admin alert ─── */
    const tenMinAgo = new Date(now.getTime() - 10 * 60 * 1000).toISOString()
    const almostBreached = await query<{
      id: string; subject: string; requester_name: string; requester_id: string
      created_at: string; category: string; priority: string; location: string; contact: string
    }>(
      `SELECT id, subject, requester_name, requester_id, created_at, category, priority, location, contact
       FROM tickets WHERE status='new' AND assignee IS NULL AND sla_admin_notified=false AND created_at <= $1`,
      [tenMinAgo]
    )

    if (almostBreached.length > 0) {
      const admins = await query<{ id: string; full_name: string; email: string }>(
        "SELECT id, full_name, email FROM users WHERE role IN ('admin','superadmin')"
      )

      for (const ticket of almostBreached) {
        await query("UPDATE tickets SET sla_admin_notified=true WHERE id=$1", [ticket.id])
        const requester = await query<{ email: string; full_name: string }>(
          "SELECT email, full_name FROM users WHERE id=$1", [ticket.requester_id]
        )
        const waitMins = Math.round((now.getTime() - new Date(ticket.created_at).getTime()) / 60000)

        for (const admin of admins) {
          await query(
            "INSERT INTO notifications (user_id, actor_id, ticket_id, type, message, is_read) VALUES ($1,$2,$3,'status_changed',$4,false)",
            [admin.id, ticket.requester_id, ticket.id,
              `SLA Alert: Ticket #${ticket.id.slice(0,8).toUpperCase()} has not been acquired for 10+ minutes. 5 minutes remaining!`]
          )
          if (admin.email) {
            await sendTicketEmail({
              to: admin.email, recipientName: admin.full_name ?? "Admin",
              actorName: ticket.requester_name ?? "User", ticketId: ticket.id,
              ticketSubject: ticket.subject, action: "sla_warning",
              comment: `⚠️ SLA WARNING: This ticket has been waiting for ${waitMins} minutes.\n\nEmployee: ${ticket.requester_name}\nEmail: ${requester[0]?.email ?? "N/A"}\nContact: ${ticket.contact ?? "N/A"}\nLocation: ${ticket.location ?? "N/A"}\nCategory: ${ticket.category ?? "N/A"}\nPriority: ${ticket.priority ?? "N/A"}\n\nOnly 5 minutes remaining before SLA response breach!`,
            }).catch(() => {})
          }
        }
        results.admin_alerts++
      }
    }

    /* ── 2. 15-min SLA response breach ─── */
    const fifteenMinAgo = new Date(now.getTime() - 15 * 60 * 1000).toISOString()
    const responseBreached = await query<{ id: string; subject: string; requester_name: string; requester_id: string }>(
      `SELECT id, subject, requester_name, requester_id FROM tickets
       WHERE status='new' AND assignee IS NULL AND sla_response_breached=false AND created_at <= $1`,
      [fifteenMinAgo]
    )

    if (responseBreached.length > 0) {
      const admins = await query<{ id: string; full_name: string; email: string }>(
        "SELECT id, full_name, email FROM users WHERE role IN ('admin','superadmin')"
      )

      for (const ticket of responseBreached) {
        await query("UPDATE tickets SET sla_response_breached=true WHERE id=$1", [ticket.id])

        const systemActorId = admins[0]?.id ?? ticket.requester_id
        await query(
          "INSERT INTO ticket_activity (ticket_id, actor_id, action, details) VALUES ($1,$2,'sla_response_breach',$3)",
          [ticket.id, systemActorId, JSON.stringify({ message: "Ticket was not acquired within 15 minutes" })]
        )

        for (const admin of admins) {
          await query(
            "INSERT INTO notifications (user_id, actor_id, ticket_id, type, message, is_read) VALUES ($1,$2,$3,'status_changed',$4,false)",
            [admin.id, ticket.requester_id, ticket.id,
              `SLA BREACH: Ticket #${ticket.id.slice(0,8).toUpperCase()} was not acquired within 15 minutes!`]
          )
          if (admin.email) {
            await sendTicketEmail({
              to: admin.email, recipientName: admin.full_name ?? "Admin",
              actorName: "SLA System", ticketId: ticket.id, ticketSubject: ticket.subject, action: "sla_breach",
              comment: `🚨 SLA BREACH: Ticket #${ticket.id.slice(0,8).toUpperCase()} has breached the 15-minute response SLA.\n\nRaised by: ${ticket.requester_name}\nNo engineer has acquired this ticket yet.\n\nImmediate action required.`,
            }).catch(() => {})
          }
        }
        results.response_breaches++
      }
    }

    /* ── 3. 6-hour resolution breach ─── */
    const resolutionBreached = await query<{
      id: string; subject: string; requester_name: string; requester_id: string; assignee: string | null
    }>(
      `SELECT id, subject, requester_name, requester_id, assignee FROM tickets
       WHERE status IN ('open','in_progress') AND sla_resolution_breached=false
         AND sla_resolution_at IS NOT NULL AND sla_resolution_at <= $1`,
      [now.toISOString()]
    )

    if (resolutionBreached.length > 0) {
      const admins = await query<{ id: string; full_name: string; email: string }>(
        "SELECT id, full_name, email FROM users WHERE role IN ('admin','superadmin')"
      )

      for (const ticket of resolutionBreached) {
        await query("UPDATE tickets SET sla_resolution_breached=true WHERE id=$1", [ticket.id])

        const systemActorId = ticket.assignee ?? admins[0]?.id ?? ticket.requester_id
        await query(
          "INSERT INTO ticket_activity (ticket_id, actor_id, action, details) VALUES ($1,$2,'sla_resolution_breach',$3)",
          [ticket.id, systemActorId, JSON.stringify({ message: "Ticket was not resolved within 6 hours" })]
        )

        const notifyUsers = [...admins]
        if (ticket.assignee) {
          const eng = await query<{ id: string; full_name: string; email: string }>(
            "SELECT id, full_name, email FROM users WHERE id=$1", [ticket.assignee]
          )
          if (eng[0]) notifyUsers.push(eng[0])
        }

        const seen = new Set<string>()
        for (const u of notifyUsers) {
          if (seen.has(u.id)) continue
          seen.add(u.id)
          await query(
            "INSERT INTO notifications (user_id, actor_id, ticket_id, type, message, is_read) VALUES ($1,$2,$3,'status_changed',$4,false)",
            [u.id, ticket.requester_id, ticket.id,
              `SLA BREACH: Ticket #${ticket.id.slice(0,8).toUpperCase()} was not resolved within 6 hours!`]
          )
          if (u.email) {
            await sendTicketEmail({
              to: u.email, recipientName: u.full_name ?? "Team",
              actorName: "SLA System", ticketId: ticket.id, ticketSubject: ticket.subject, action: "sla_breach",
              comment: `🚨 SLA BREACH: Ticket #${ticket.id.slice(0,8).toUpperCase()} was not resolved within 6 hours.\n\nRaised by: ${ticket.requester_name}\n\nPlease take immediate action.`,
            }).catch(() => {})
          }
        }
        results.resolution_breaches++
      }
    }

    return NextResponse.json({ success: true, ...results })
  } catch (err) {
    console.error("SLA check failed:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
