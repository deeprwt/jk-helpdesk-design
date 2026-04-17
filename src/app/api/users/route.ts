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

    let sql = "SELECT id, email, full_name, first_name, last_name, role, org_domain, avatar_url, is_verified, created_at FROM users WHERE 1=1"
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

    sql += " ORDER BY full_name ASC"

    const users = await query(sql, params)
    return NextResponse.json({ users })
  } catch (err) {
    console.error("Users fetch failed:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
