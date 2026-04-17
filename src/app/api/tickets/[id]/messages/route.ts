import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { query, queryOne } from "@/lib/db"

export const runtime = "nodejs"

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params

    const messages = await query(
      `SELECT m.*, u.avatar_url AS sender_avatar
       FROM ticket_messages m
       LEFT JOIN users u ON u.id = m.sender_id
       WHERE m.ticket_id = $1
       ORDER BY m.created_at ASC`,
      [id]
    )

    return NextResponse.json({ messages })
  } catch (err) {
    console.error("Messages fetch failed:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const { message } = await req.json()

    if (!message?.trim()) return NextResponse.json({ error: "Message is required" }, { status: 400 })

    const msg = await queryOne(
      `INSERT INTO ticket_messages (ticket_id, sender_id, sender_name, message)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [id, user.id, user.full_name, message.trim()]
    )

    return NextResponse.json({ success: true, message: msg })
  } catch (err) {
    console.error("Message create failed:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
