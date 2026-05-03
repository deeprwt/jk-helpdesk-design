import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { query } from "@/lib/db"

export const runtime = "nodejs"

export async function PATCH(req: Request) {
  try {
    const user = await requireAuth(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    await query("UPDATE users SET last_seen_at = NOW() WHERE id = $1", [user.id])
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Presence update failed:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
