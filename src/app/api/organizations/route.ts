import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { query, queryOne } from "@/lib/db"

export const runtime = "nodejs"

export async function GET(req: Request) {
  try {
    const user = await requireAuth(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    if (user.role !== "superadmin" && user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const organizations = await query(
      "SELECT * FROM organizations ORDER BY name ASC"
    )

    return NextResponse.json({ organizations })
  } catch (err) {
    console.error("Orgs fetch failed:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireAuth(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    if (user.role !== "superadmin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { name, domain, status } = await req.json()
    if (!name || !domain) return NextResponse.json({ error: "Name and domain are required" }, { status: 400 })

    const org = await queryOne(
      "INSERT INTO organizations (name, domain, status) VALUES ($1,$2,$3) ON CONFLICT (domain) DO NOTHING RETURNING *",
      [name, domain.toLowerCase().trim(), status ?? "active"]
    )

    return NextResponse.json({ success: true, organization: org })
  } catch (err) {
    console.error("Org create failed:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await requireAuth(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    if (user.role !== "superadmin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id, name, status } = await req.json()
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 })

    await query(
      "UPDATE organizations SET name=COALESCE($2,name), status=COALESCE($3,status) WHERE id=$1",
      [id, name ?? null, status ?? null]
    )

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Org update failed:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
