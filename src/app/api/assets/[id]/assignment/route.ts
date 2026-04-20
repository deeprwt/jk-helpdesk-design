import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { query, queryOne } from "@/lib/db"

export const runtime = "nodejs"

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const row = await queryOne<{
      id: string; asset_id: string; user_id: string;
      assigned_by: string | null; assigned_at: string; returned_at: string | null;
    }>(
      `SELECT id, asset_id, user_id, assigned_by, assigned_at, returned_at
       FROM asset_assignments
       WHERE asset_id=$1 AND returned_at IS NULL
       ORDER BY assigned_at DESC
       LIMIT 1`,
      [id]
    )

    if (!row) return NextResponse.json(null)
    return NextResponse.json(row)
  } catch (err) {
    console.error("Asset current assignment fetch failed:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const body = await req.json()
    const userId: string | undefined = body?.user_id
    const assignedBy: string | null = body?.assigned_by ?? user.id ?? null

    if (!userId) return NextResponse.json({ error: "user_id is required" }, { status: 400 })

    // Close any open assignment for this asset
    await query(
      "UPDATE asset_assignments SET returned_at = NOW() WHERE asset_id=$1 AND returned_at IS NULL",
      [id]
    )

    // Insert new assignment
    await query(
      `INSERT INTO asset_assignments (asset_id, user_id, assigned_by, assigned_at)
       VALUES ($1,$2,$3,NOW())`,
      [id, userId, assignedBy]
    )

    // Mirror current assignee onto assets row
    await query("UPDATE assets SET assigned_to=$2, updated_at=NOW() WHERE id=$1", [id, userId])

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Asset assign failed:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    await query(
      "UPDATE asset_assignments SET returned_at = NOW() WHERE asset_id=$1 AND returned_at IS NULL",
      [id]
    )
    await query("UPDATE assets SET assigned_to=NULL, updated_at=NOW() WHERE id=$1", [id])
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Asset unassign failed:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
