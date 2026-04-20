import { NextResponse } from "next/server"
import { randomBytes, createHash } from "crypto"
import { query, queryOne } from "@/lib/db"
import { sendVerificationEmail } from "@/lib/email"
import { getAppUrl } from "@/lib/app-url"

export const runtime = "nodejs"

function hashToken(t: string) {
  return createHash("sha256").update(t).digest("hex")
}

export async function POST(req: Request) {
  try {
    const { email } = await req.json()
    if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 })

    const user = await queryOne<{ id: string; full_name: string }>(
      "SELECT id, full_name FROM users WHERE email = $1",
      [email.toLowerCase().trim()]
    )

    // Always return success to avoid user enumeration
    if (!user) {
      return NextResponse.json({ success: true, message: "If that email exists, a reset link was sent." })
    }

    const rawToken = randomBytes(32).toString("hex")
    const hashedToken = hashToken(rawToken)
    const expiry = new Date(Date.now() + 30 * 60 * 1000).toISOString()

    await query(
      "UPDATE users SET reset_token = $1, reset_token_expiry = $2 WHERE id = $3",
      [hashedToken, expiry, user.id]
    )

    const appUrl = getAppUrl()
    const resetUrl = `${appUrl}/update-password?token=${rawToken}&uid=${user.id}`

    sendVerificationEmail({
      to: email,
      recipientName: user.full_name || "User",
      verificationUrl: resetUrl,
    }).catch(() => {})

    return NextResponse.json({ success: true, message: "If that email exists, a reset link was sent." })
  } catch (err) {
    console.error("Forgot password failed:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
