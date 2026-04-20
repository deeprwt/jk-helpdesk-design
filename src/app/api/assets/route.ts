import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { query, queryOne } from "@/lib/db"

export const runtime = "nodejs"

const ASSET_COLUMNS = `id, asset_code, asset_type, model, status, location, department,
  purchase_date, warranty_expiry, assigned_to, org_domain, created_at, updated_at, name, type, serial_number`

export async function GET(req: Request) {
  try {
    const user = await requireAuth(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const org = searchParams.get("org_domain") ?? (user.role !== "superadmin" ? user.org_domain : undefined)
    const idsParam = searchParams.get("ids")

    let sql = `SELECT ${ASSET_COLUMNS} FROM assets WHERE 1=1`
    const params: unknown[] = []
    let idx = 1

    if (org) {
      sql += ` AND org_domain = $${idx++}`
      params.push(org)
    }

    if (idsParam) {
      const ids = idsParam.split(",").map((s) => s.trim()).filter(Boolean)
      if (ids.length > 0) {
        sql += ` AND id = ANY($${idx++}::uuid[])`
        params.push(ids)
      }
    }

    sql += " ORDER BY created_at DESC"

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
    const {
      asset_code, asset_type, model, status, location, department,
      purchase_date, warranty_expiry,
    } = body as Record<string, string | null | undefined>

    if (!asset_code) return NextResponse.json({ error: "Asset code is required" }, { status: 400 })

    const asset = await queryOne<{ id: string }>(
      `INSERT INTO assets
         (asset_code, asset_type, model, status, location, department,
          purchase_date, warranty_expiry, org_domain)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id`,
      [
        asset_code,
        asset_type ?? null,
        model ?? null,
        status ?? "in_use",
        location ?? null,
        department ?? null,
        purchase_date || null,
        warranty_expiry || null,
        user.org_domain,
      ]
    )

    return NextResponse.json({ success: true, asset: { id: asset?.id } })
  } catch (err) {
    console.error("Asset create failed:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
