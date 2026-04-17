import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { query, queryOne } from "@/lib/db"
import { sendTicketEmail } from "@/lib/email"

export const runtime = "nodejs"

export async function POST(req: Request) {
  try {
    const user = await requireAuth(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { ticket_id, new_engineer_id } = await req.json()
    if (!ticket_id || !new_engineer_id) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 })
    }

    const ticket = await queryOne<{ id: string; assignee: string | null; requester_id: string; subject: string }>(
      "SELECT id, assignee, requester_id, subject FROM tickets WHERE id = $1",
      [ticket_id]
    )

    if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 })

    const previousAssignee = ticket.assignee

    /* Close previous assignment */
    if (previousAssignee) {
      await query(
        "UPDATE ticket_assignments SET unassigned_at = NOW() WHERE ticket_id=$1 AND engineer_id=$2 AND unassigned_at IS NULL",
        [ticket_id, previousAssignee]
      )
    }

    /* Update ticket */
    await query(
      "UPDATE tickets SET assignee=$1, assigned_at=NOW(), status='open' WHERE id=$2",
      [new_engineer_id, ticket_id]
    )

    /* New assignment record */
    await query(
      "INSERT INTO ticket_assignments (ticket_id, engineer_id, action) VALUES ($1,$2,'reassigned')",
      [ticket_id, new_engineer_id]
    )

    const [prevEng, newEng] = await Promise.all([
      previousAssignee
        ? queryOne<{ full_name: string; email: string }>("SELECT full_name, email FROM users WHERE id=$1", [previousAssignee])
        : null,
      queryOne<{ full_name: string; email: string }>("SELECT full_name, email FROM users WHERE id=$1", [new_engineer_id]),
    ])

    /* Log activity */
    await query(
      "INSERT INTO ticket_activity (ticket_id, actor_id, action, details) VALUES ($1,$2,'reassigned',$3)",
      [ticket_id, user.id, JSON.stringify({
        previous_assignee: previousAssignee,
        previous_engineer_name: prevEng?.full_name ?? null,
        new_assignee: new_engineer_id,
        new_engineer_name: newEng?.full_name ?? "Engineer",
      })]
    )

    const ticketShortId = ticket_id.slice(0, 8).toUpperCase()
    const newEngineerName = newEng?.full_name ?? "Support Engineer"
    const prevEngineerName = prevEng?.full_name ?? "Previous Engineer"

    const requester = await queryOne<{ full_name: string; email: string }>(
      "SELECT full_name, email FROM users WHERE id=$1",
      [ticket.requester_id]
    )

    /* Emails */
    if (requester?.email) {
      sendTicketEmail({ to: requester.email, recipientName: requester.full_name, actorName: newEngineerName,
        ticketId: ticket_id, ticketSubject: ticket.subject, action: "reassigned",
        comment: `Your ticket has been reassigned from ${prevEngineerName} to ${newEngineerName}.` }).catch(() => {})
    }

    if (newEng?.email) {
      sendTicketEmail({ to: newEng.email, recipientName: newEngineerName, actorName: "Admin",
        ticketId: ticket_id, ticketSubject: ticket.subject, action: "acquired",
        comment: `Ticket #${ticketShortId} has been assigned to you.` }).catch(() => {})
    }

    if (previousAssignee && prevEng?.email) {
      sendTicketEmail({ to: prevEng.email, recipientName: prevEngineerName, actorName: "Admin",
        ticketId: ticket_id, ticketSubject: ticket.subject, action: "reassigned",
        comment: `Ticket #${ticketShortId} has been reassigned from you to ${newEngineerName}.` }).catch(() => {})
    }

    /* In-app notifications */
    const notifs: { user_id: string; type: string; message: string }[] = []

    if (ticket.requester_id !== user.id) {
      notifs.push({ user_id: ticket.requester_id, type: "status_changed",
        message: `reassigned your ticket #${ticketShortId} to ${newEngineerName}` })
    }
    if (new_engineer_id !== user.id) {
      notifs.push({ user_id: new_engineer_id, type: "acquired",
        message: `assigned ticket #${ticketShortId} to you` })
    }
    if (previousAssignee && previousAssignee !== user.id) {
      notifs.push({ user_id: previousAssignee, type: "status_changed",
        message: `unassigned you from ticket #${ticketShortId} and reassigned to ${newEngineerName}` })
    }

    for (const n of notifs) {
      await query(
        "INSERT INTO notifications (user_id, actor_id, ticket_id, type, message, is_read) VALUES ($1,$2,$3,$4,$5,false)",
        [n.user_id, user.id, ticket_id, n.type, n.message]
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Reassign failed:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
