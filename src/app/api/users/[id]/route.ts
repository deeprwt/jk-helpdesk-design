import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { query, queryOne } from "@/lib/db"

export const runtime = "nodejs"

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const targetId = id === "me" ? user.id : id

    const found = await queryOne(
      `SELECT id, email, full_name, first_name, last_name, role, org_domain, avatar_url,
              phone, city, country, postal_code, present_address, permanent_address,
              employee_id, designation, department, position, manager,
              is_verified, created_at
         FROM users WHERE id=$1`,
      [targetId]
    )

    if (!found) return NextResponse.json({ error: "User not found" }, { status: 404 })
    return NextResponse.json({ user: found })
  } catch (err) {
    console.error("User fetch failed:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const targetId = id === "me" ? user.id : id

    // Only allow self-edit or admin
    if (targetId !== user.id && user.role !== "admin" && user.role !== "superadmin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json()
    const allowed = [
      "first_name", "last_name", "full_name",
      "phone", "city", "country", "postal_code",
      "present_address", "permanent_address",
      "employee_id", "designation", "department", "position", "manager",
      "avatar_url", "role",
    ]
    const updates = Object.entries(body).filter(([k]) => allowed.includes(k))

    if (updates.length === 0) return NextResponse.json({ error: "No valid fields" }, { status: 400 })

    // Rebuild full_name if name parts change
    const firstName = body.first_name
    const lastName = body.last_name
    if (firstName !== undefined || lastName !== undefined) {
      const current = await queryOne<{ first_name: string; last_name: string }>(
        "SELECT first_name, last_name FROM users WHERE id=$1", [targetId]
      )
      const fn = firstName ?? current?.first_name ?? ""
      const ln = lastName ?? current?.last_name ?? ""
      updates.push(["full_name", `${fn} ${ln}`.trim()])
    }

    const setClauses = updates.map(([k], i) => `${k} = $${i + 2}`).join(", ")
    const values = [targetId, ...updates.map(([, v]) => v)]

    await query(`UPDATE users SET ${setClauses} WHERE id=$1`, values)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("User update failed:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
