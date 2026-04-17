import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { query, queryOne } from "@/lib/db"

export const runtime = "nodejs"

export async function GET(req: Request) {
  try {
    const user = await requireAuth(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const org = searchParams.get("org_domain") ?? (user.role !== "superadmin" ? user.org_domain : undefined)

    let sql = `SELECT a.*, u.full_name AS assigned_to_name FROM assets a LEFT JOIN users u ON u.id = a.assigned_to WHERE 1=1`
    const params: unknown[] = []
    let idx = 1

    if (org) {
      sql += ` AND a.org_domain = $${idx++}`
      params.push(org)
    }

    sql += " ORDER BY a.created_at DESC"

    const assets = await query(sql, params)
    return NextResponse.json({ assets })
  } catch (err) {
    console.error("Assets fetch failed:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireAuth(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await req.json()
    const { name, type, serial_number, status, assigned_to } = body

    if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 })

    const asset = await queryOne<{ id: string }>(
      "INSERT INTO assets (name, type, serial_number, status, assigned_to, org_domain) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id",
      [name, type ?? null, serial_number ?? null, status ?? "available", assigned_to ?? null, user.org_domain]
    )

    return NextResponse.json({ success: true, assetId: asset?.id })
  } catch (err) {
    console.error("Asset create failed:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
