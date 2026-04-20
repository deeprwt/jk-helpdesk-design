import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { query } from "@/lib/db"

export const runtime = "nodejs"

// Returns all asset_details rows for assets the caller can see.
export async function GET(req: Request) {
  try {
    const user = await requireAuth(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const org = user.role === "superadmin" ? null : user.org_domain

    const sql = org
      ? `SELECT d.asset_id, d.key, d.value
         FROM asset_details d
         JOIN assets a ON a.id = d.asset_id
         WHERE a.org_domain = $1`
      : `SELECT asset_id, key, value FROM asset_details`

    const details = await query(sql, org ? [org] : [])
    return NextResponse.json({ details })
  } catch (err) {
    console.error("Asset details (global) fetch failed:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
