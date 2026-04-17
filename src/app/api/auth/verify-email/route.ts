import { NextResponse } from "next/server"
import { createHash } from "crypto"
import { query, queryOne } from "@/lib/db"

export const runtime = "nodejs"

function hashToken(t: string) {
  return createHash("sha256").update(t).digest("hex")
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const token = searchParams.get("token")
    const uid = searchParams.get("uid")

    if (!token || !uid) {
      return NextResponse.json({ error: "Missing token or user ID" }, { status: 400 })
    }

    const user = await queryOne<{
      id: string; verification_token: string | null
      token_expiry: string | null; is_verified: boolean
    }>(
      "SELECT id, verification_token, token_expiry, is_verified FROM users WHERE id = $1",
      [uid]
    )

    if (!user) return NextResponse.json({ error: "Invalid verification link" }, { status: 400 })

    if (user.is_verified) {
      return NextResponse.json({ success: true, message: "Email already verified.", already_verified: true })
    }

    if (!user.verification_token) {
      return NextResponse.json({ error: "No pending verification." }, { status: 400 })
    }

    if (user.token_expiry && new Date(user.token_expiry) < new Date()) {
      return NextResponse.json({ error: "Verification link has expired." }, { status: 410 })
    }

    if (hashToken(token) !== user.verification_token) {
      return NextResponse.json({ error: "Invalid verification link" }, { status: 400 })
    }

    await query(
      "UPDATE users SET is_verified = true, verification_token = NULL, token_expiry = NULL WHERE id = $1",
      [uid]
    )

    return NextResponse.json({ success: true, message: "Email verified successfully. You can now log in." })
  } catch (err) {
    console.error("Verify email failed:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
