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
    if (!email) return NextResponse.json({ error: "Email is required" }, { status: 400 })

    const user = await queryOne<{ id: string; full_name: string; is_verified: boolean }>(
      "SELECT id, full_name, is_verified FROM users WHERE email = $1",
      [email.toLowerCase().trim()]
    )

    if (!user) {
      return NextResponse.json({ success: true, message: "If an account exists, a verification link was sent." })
    }

    if (user.is_verified) {
      return NextResponse.json({ success: true, message: "Email is already verified.", already_verified: true })
    }

    const rawToken = randomBytes(32).toString("hex")
    const hashedToken = hashToken(rawToken)
    const tokenExpiry = new Date(Date.now() + 30 * 60 * 1000).toISOString()

    await query(
      "UPDATE users SET verification_token = $1, token_expiry = $2 WHERE id = $3",
      [hashedToken, tokenExpiry, user.id]
    )

    const appUrl = getAppUrl()
    const verificationUrl = `${appUrl}/verify-email?token=${rawToken}&uid=${user.id}`

    sendVerificationEmail({ to: email, recipientName: user.full_name || "User", verificationUrl }).catch(console.error)

    return NextResponse.json({ success: true, message: "Verification email sent." })
  } catch (err) {
    console.error("Resend verification failed:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
