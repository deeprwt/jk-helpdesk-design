import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { query, queryOne } from "@/lib/db"

export const runtime = "nodejs"

export async function POST(req: Request) {
  try {
    const user = await requireAuth(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    if (user.role !== "admin" && user.role !== "superadmin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { target_user_id } = await req.json()
    if (!target_user_id) return NextResponse.json({ error: "Missing target_user_id" }, { status: 400 })

    if (target_user_id === user.id) {
      return NextResponse.json({ error: "Cannot delete yourself" }, { status: 400 })
    }

    const targetUser = await queryOne<{ role: string }>(
      "SELECT role FROM users WHERE id=$1", [target_user_id]
    )

    if (!targetUser) return NextResponse.json({ error: "User not found" }, { status: 404 })

    if (targetUser.role === "admin" || targetUser.role === "superadmin") {
      return NextResponse.json({ error: "Cannot delete admin or superadmin accounts" }, { status: 403 })
    }

    await query("DELETE FROM users WHERE id=$1", [target_user_id])

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("User delete failed:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
