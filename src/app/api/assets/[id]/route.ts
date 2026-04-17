import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { query, queryOne } from "@/lib/db"

export const runtime = "nodejs"

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params

    const asset = await queryOne(
      `SELECT a.*, u.full_name AS assigned_to_name, u.email AS assigned_to_email
       FROM assets a LEFT JOIN users u ON u.id = a.assigned_to WHERE a.id=$1`,
      [id]
    )

    if (!asset) return NextResponse.json({ error: "Asset not found" }, { status: 404 })

    const details = await query("SELECT key, value FROM asset_details WHERE asset_id=$1", [id])
    const tickets = await query(
      `SELECT t.id, t.subject, t.status, t.created_at FROM asset_tickets at
       JOIN tickets t ON t.id = at.ticket_id WHERE at.asset_id=$1 ORDER BY t.created_at DESC`,
      [id]
    )

    return NextResponse.json({ asset: { ...asset, details, tickets } })
  } catch (err) {
    console.error("Asset fetch failed:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const body = await req.json()

    const allowed = ["name", "type", "serial_number", "status", "assigned_to"]
    const updates = Object.entries(body).filter(([k]) => allowed.includes(k))
    if (updates.length === 0) return NextResponse.json({ error: "No valid fields" }, { status: 400 })

    const setClauses = updates.map(([k], i) => `${k} = $${i + 2}`).join(", ")
    const values = [id, ...updates.map(([, v]) => v)]
    await query(`UPDATE assets SET ${setClauses} WHERE id=$1`, values)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Asset update failed:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    if (user.role !== "admin" && user.role !== "superadmin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id } = await params
    await query("DELETE FROM assets WHERE id=$1", [id])
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Asset delete failed:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
