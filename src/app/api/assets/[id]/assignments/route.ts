import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { query } from "@/lib/db"

export const runtime = "nodejs"

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const assignments = await query(
      `SELECT id, asset_id, user_id, assigned_by, assigned_at, returned_at
       FROM asset_assignments
       WHERE asset_id=$1
       ORDER BY assigned_at ASC`,
      [id]
    )
    return NextResponse.json({ assignments })
  } catch (err) {
    console.error("Asset assignments fetch failed:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
