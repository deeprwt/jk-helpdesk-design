import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { query } from "@/lib/db"

export const runtime = "nodejs"

// Returns current (open) assignments for all assets the caller can see.
export async function GET(req: Request) {
  try {
    const user = await requireAuth(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const org = user.role === "superadmin" ? null : user.org_domain

    const sql = org
      ? `SELECT aa.asset_id, aa.user_id, aa.assigned_by, aa.assigned_at, aa.returned_at
         FROM asset_assignments aa
         JOIN assets a ON a.id = aa.asset_id
         WHERE aa.returned_at IS NULL AND a.org_domain = $1`
      : `SELECT aa.asset_id, aa.user_id, aa.assigned_by, aa.assigned_at, aa.returned_at
         FROM asset_assignments aa
         WHERE aa.returned_at IS NULL`

    const assignments = await query(sql, org ? [org] : [])
    return NextResponse.json({ assignments })
  } catch (err) {
    console.error("Asset assignments (global) fetch failed:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
