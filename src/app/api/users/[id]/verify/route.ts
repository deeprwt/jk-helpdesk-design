import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { query, queryOne } from "@/lib/db"
import { sendAccountVerifiedEmail } from "@/lib/email"

export const runtime = "nodejs"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireAuth(req)
    if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (actor.role !== "superadmin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id } = await params

    const target = await queryOne<{ id: string; email: string; full_name: string; is_verified: boolean }>(
      "SELECT id, email, full_name, is_verified FROM users WHERE id = $1",
      [id]
    )

    if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 })
    if (target.is_verified) {
      return NextResponse.json({ error: "User is already verified" }, { status: 409 })
    }

    await query(
      `UPDATE users
          SET is_verified = true,
              verification_token = NULL,
              token_expiry = NULL,
              updated_at = NOW()
        WHERE id = $1`,
      [id]
    )

    try {
      await sendAccountVerifiedEmail({
        to: target.email,
        recipientName: target.full_name || target.email,
        verifiedByName: actor.full_name || "the administrator",
      })
    } catch (emailErr) {
      console.error("Account-verified email failed (user still marked verified):", emailErr)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("User verify failed:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
