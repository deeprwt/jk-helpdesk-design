import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { query } from "@/lib/db"

export const runtime = "nodejs"

export async function PATCH(req: Request) {
  try {
    const user = await requireAuth(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    await query(
      "UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false",
      [user.id]
    )

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Mark read failed:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
