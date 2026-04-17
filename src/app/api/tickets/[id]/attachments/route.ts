import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { query } from "@/lib/db"

export const runtime = "nodejs"

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params

    const attachments = await query(
      "SELECT * FROM ticket_attachments WHERE ticket_id=$1 ORDER BY created_at",
      [id]
    )

    return NextResponse.json({ attachments })
  } catch (err) {
    console.error("Attachments fetch failed:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
