import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { query } from "@/lib/db"

export const runtime = "nodejs"

export async function GET(req: Request) {
  try {
    const user = await requireAuth(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const role = searchParams.get("role")
    const org = searchParams.get("org_domain") ?? (user.role !== "superadmin" ? user.org_domain : undefined)
    const onlineSince = searchParams.get("online_since")
    const limitRaw = searchParams.get("limit")
    const limit = limitRaw ? Math.max(1, Math.min(parseInt(limitRaw, 10) || 0, 500)) : null

    let sql = `SELECT id, email, full_name, first_name, last_name, role, org_domain, avatar_url,
                      phone, city, state, employee_id, designation, department, position, manager,
                      is_verified, last_seen_at, created_at
               FROM users WHERE 1=1`
    const params: unknown[] = []
    let idx = 1

    if (org) {
      sql += ` AND org_domain = $${idx++}`
      params.push(org)
    }
    if (role) {
      sql += ` AND role = $${idx++}`
      params.push(role)
    }
    if (onlineSince) {
      sql += ` AND last_seen_at IS NOT NULL AND last_seen_at >= $${idx++}`
      params.push(onlineSince)
    }

    sql += " ORDER BY full_name ASC"

    if (limit) {
      sql += ` LIMIT $${idx++}`
      params.push(limit)
    }

    const users = await query(sql, params)
    return NextResponse.json({ users })
  } catch (err) {
    console.error("Users fetch failed:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
