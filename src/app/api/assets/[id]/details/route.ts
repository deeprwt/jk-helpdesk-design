import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { query } from "@/lib/db"

export const runtime = "nodejs"

type DetailRow = { key: string; value: string }

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const details = await query<DetailRow>(
      "SELECT key, value FROM asset_details WHERE asset_id=$1",
      [id]
    )
    return NextResponse.json({ details })
  } catch (err) {
    console.error("Asset details fetch failed:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const body = await req.json()
    const details: DetailRow[] = Array.isArray(body?.details) ? body.details : []

    for (const d of details) {
      if (!d?.key) continue
      await query(
        "INSERT INTO asset_details (asset_id, key, value) VALUES ($1,$2,$3)",
        [id, d.key, d.value ?? ""]
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Asset details insert failed:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    await query("DELETE FROM asset_details WHERE asset_id=$1", [id])
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Asset details delete failed:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
