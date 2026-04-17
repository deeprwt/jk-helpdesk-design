import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { sendTicketEmail, type EmailAction } from "@/lib/email"

export const runtime = "nodejs"

export async function POST(req: Request) {
  try {
    const user = await requireAuth(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { recipient_email, recipient_name, actor_name, ticket_id, ticket_subject, action, comment } = await req.json()

    if (!recipient_email || !actor_name || !ticket_id || !ticket_subject || !action) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    await sendTicketEmail({
      to: recipient_email,
      recipientName: recipient_name ?? "User",
      actorName: actor_name,
      ticketId: ticket_id,
      ticketSubject: ticket_subject,
      action: action as EmailAction,
      comment: comment ?? null,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Email send failed:", err)
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 })
  }
}
