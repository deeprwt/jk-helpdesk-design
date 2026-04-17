import { NextResponse } from "next/server"
import { createHash } from "crypto"
import bcrypt from "bcryptjs"
import { query, queryOne } from "@/lib/db"

export const runtime = "nodejs"

function hashToken(t: string) {
  return createHash("sha256").update(t).digest("hex")
}

export async function POST(req: Request) {
  try {
    const { token, uid, password } = await req.json()

    if (!token || !uid || !password) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 })
    }

    const user = await queryOne<{ id: string; reset_token: string; reset_token_expiry: string }>(
      "SELECT id, reset_token, reset_token_expiry FROM users WHERE id = $1",
      [uid]
    )

    if (!user || !user.reset_token) {
      return NextResponse.json({ error: "Invalid or expired reset link" }, { status: 400 })
    }

    if (new Date(user.reset_token_expiry) < new Date()) {
      return NextResponse.json({ error: "Reset link has expired" }, { status: 410 })
    }

    if (hashToken(token) !== user.reset_token) {
      return NextResponse.json({ error: "Invalid reset link" }, { status: 400 })
    }

    const hash = await bcrypt.hash(password, 10)

    await query(
      "UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expiry = NULL WHERE id = $2",
      [hash, uid]
    )

    return NextResponse.json({ success: true, message: "Password updated. You can now sign in." })
  } catch (err) {
    console.error("Reset password failed:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
