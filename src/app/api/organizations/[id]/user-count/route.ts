import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { queryOne } from "@/lib/db"

export const runtime = "nodejs"

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    if (user.role !== "superadmin" && user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id } = await params

    const row = await queryOne<{ count: number }>(
      `SELECT COUNT(u.id)::int AS count
         FROM users u
         JOIN organizations o ON LOWER(u.org_domain) = LOWER(o.domain)
        WHERE o.id = $1`,
      [id]
    )

    return NextResponse.json({ count: row?.count ?? 0 })
  } catch (err) {
    console.error("Org user-count fetch failed:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
