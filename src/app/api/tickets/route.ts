import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { query } from "@/lib/db"

export const runtime = "nodejs"

export async function GET(req: Request) {
  try {
    const user = await requireAuth(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const status = searchParams.get("status")
    const assignee = searchParams.get("assignee")
    const requester = searchParams.get("requester_id")
    const limit = parseInt(searchParams.get("limit") ?? "100")

    let sql = `
      SELECT t.*,
             u.full_name AS requester_full_name,
             a.full_name AS assignee_full_name
      FROM tickets t
      LEFT JOIN users u ON u.id = t.requester_id
      LEFT JOIN users a ON a.id = t.assignee
      WHERE 1=1`

    const params: unknown[] = []
    let idx = 1

    if (user.role === "user") {
      sql += ` AND t.requester_id = $${idx++}`
      params.push(user.id)
    } else if (user.role === "engineer") {
      sql += ` AND (t.assignee = $${idx++} OR t.requester_id = $${idx++})`
      params.push(user.id, user.id)
    } else if (user.role !== "superadmin") {
      sql += ` AND t.org_domain = $${idx++}`
      params.push(user.org_domain)
    }

    if (status) {
      sql += ` AND t.status = $${idx++}`
      params.push(status)
    }
    if (assignee) {
      sql += ` AND t.assignee = $${idx++}`
      params.push(assignee)
    }
    if (requester) {
      sql += ` AND t.requester_id = $${idx++}`
      params.push(requester)
    }

    sql += ` ORDER BY t.created_at DESC LIMIT $${idx++}`
    params.push(limit)

    const tickets = await query(sql, params)
    return NextResponse.json({ tickets })
  } catch (err) {
    console.error("Tickets fetch failed:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
