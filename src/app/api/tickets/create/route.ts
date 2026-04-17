import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { query, queryOne } from "@/lib/db"
import { sendTicketEmail } from "@/lib/email"
import { writeFile, mkdir } from "fs/promises"
import { join } from "path"

export const runtime = "nodejs"

export async function POST(req: Request) {
  try {
    const user = await requireAuth(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const formData = await req.formData()
    const files = formData.getAll("attachments") as File[]

    const requesterId = formData.get("requester_id")?.toString()
    if (!requesterId) {
      return NextResponse.json({ error: "Requester is required" }, { status: 400 })
    }

    const now = new Date()
    const slaResponseAt = new Date(now.getTime() + 15 * 60 * 1000).toISOString()

    /* 1. Insert ticket */
    const ticket = await queryOne<{ id: string; subject: string }>(
      `INSERT INTO tickets (requester_id, requester_name, contact, subject, description,
        category, sub_category, priority, status, location, link, sla_response_at, org_domain)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'new',$9,$10,$11,$12)
       RETURNING id, subject`,
      [
        requesterId,
        formData.get("requester_name")?.toString() ?? "",
        formData.get("contact")?.toString() ?? null,
        formData.get("subject")?.toString() ?? "",
        formData.get("description")?.toString() ?? null,
        formData.get("category")?.toString() ?? null,
        formData.get("sub_category")?.toString() ?? null,
        formData.get("priority")?.toString() ?? null,
        formData.get("location")?.toString() ?? null,
        formData.get("link")?.toString() ?? null,
        slaResponseAt,
        user.org_domain,
      ]
    )

    if (!ticket) throw new Error("Ticket insert failed")

    /* 2. Log activity */
    await query(
      "INSERT INTO ticket_activity (ticket_id, actor_id, action, details) VALUES ($1,$2,'created','{}')",
      [ticket.id, requesterId]
    )

    const ticketShortId = ticket.id.slice(0, 8).toUpperCase()
    const requesterName = formData.get("requester_name")?.toString() ?? ""

    /* 3. Requester email */
    const requesterData = await queryOne<{ email: string }>(
      "SELECT email FROM users WHERE id = $1",
      [requesterId]
    )

    if (requesterData?.email) {
      sendTicketEmail({
        to: requesterData.email,
        recipientName: requesterName,
        actorName: requesterName,
        ticketId: ticket.id,
        ticketSubject: ticket.subject,
        action: "created",
      }).catch(() => {})
    }

    /* 4. Notify admins */
    const admins = await query<{ id: string; full_name: string; email: string }>(
      "SELECT id, full_name, email FROM users WHERE role IN ('admin','superadmin')"
    )

    for (const admin of admins) {
      if (admin.id === requesterId) continue

      await query(
        "INSERT INTO notifications (user_id, actor_id, ticket_id, type, message, is_read) VALUES ($1,$2,$3,'status_changed',$4,false)",
        [admin.id, requesterId, ticket.id, `New ticket #${ticketShortId} raised by ${requesterName}`]
      )

      if (admin.email) {
        sendTicketEmail({
          to: admin.email,
          recipientName: admin.full_name ?? "Admin",
          actorName: requesterName,
          ticketId: ticket.id,
          ticketSubject: ticket.subject,
          action: "created",
        }).catch(() => {})
      }
    }

    /* 5. Link asset */
    const assetId = formData.get("asset_id")?.toString()
    if (assetId) {
      await query(
        "INSERT INTO asset_tickets (ticket_id, asset_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
        [ticket.id, assetId]
      )
    }

    /* 6. Upload attachments to local disk */
    for (const file of files) {
      if (!file || file.size === 0) continue

      const buffer = Buffer.from(await file.arrayBuffer())
      const dir = join(process.cwd(), "uploads", "tickets", ticket.id)
      await mkdir(dir, { recursive: true })

      const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`
      const filePath = join(dir, fileName)
      await writeFile(filePath, buffer)

      const dbPath = `/uploads/tickets/${ticket.id}/${fileName}`

      await query(
        "INSERT INTO ticket_attachments (ticket_id, file_name, file_path, file_type, file_size) VALUES ($1,$2,$3,$4,$5)",
        [ticket.id, file.name, dbPath, file.type, file.size]
      )
    }

    return NextResponse.json({ success: true, ticketId: ticket.id })
  } catch (err) {
    console.error("Ticket create failed:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
