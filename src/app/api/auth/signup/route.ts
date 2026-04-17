import { NextResponse } from "next/server"
import { randomBytes, createHash } from "crypto"
import bcrypt from "bcryptjs"
import { query, queryOne } from "@/lib/db"
import { sendVerificationEmail } from "@/lib/email"

export const runtime = "nodejs"

function hashToken(t: string) {
  return createHash("sha256").update(t).digest("hex")
}

export async function POST(req: Request) {
  try {
    const { email, password, first_name, last_name } = await req.json()

    if (!email || !password || !first_name || !last_name) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 })
    }

    const normalizedEmail = email.toLowerCase().trim()
    const domain = normalizedEmail.split("@")[1]

    if (!domain) return NextResponse.json({ error: "Invalid email address" }, { status: 400 })

    /* 1. Check organization whitelist */
    const org = await queryOne(
      "SELECT id FROM organizations WHERE domain = $1 AND status = 'active'",
      [domain]
    )

    if (!org) {
      return NextResponse.json(
        { error: "Your organization does not have permission to sign up. Please contact the administrator." },
        { status: 403 }
      )
    }

    /* 2. Check duplicate */
    const existing = await queryOne("SELECT id FROM users WHERE email = $1", [normalizedEmail])
    if (existing) {
      return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 })
    }

    /* 3. Hash password */
    const passwordHash = await bcrypt.hash(password, 10)
    const fullName = `${first_name.trim()} ${last_name.trim()}`

    /* 4. Generate verification token */
    const rawToken = randomBytes(32).toString("hex")
    const hashedToken = hashToken(rawToken)
    const tokenExpiry = new Date(Date.now() + 30 * 60 * 1000).toISOString()

    /* 5. Insert user */
    const newUser = await queryOne<{ id: string }>(
      `INSERT INTO users (email, password_hash, first_name, last_name, full_name, org_domain,
        is_verified, verification_token, token_expiry)
       VALUES ($1, $2, $3, $4, $5, $6, false, $7, $8)
       RETURNING id`,
      [normalizedEmail, passwordHash, first_name.trim(), last_name.trim(), fullName, domain, hashedToken, tokenExpiry]
    )

    if (!newUser) throw new Error("User insert failed")

    /* 6. Send verification email */
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
    const verificationUrl = `${appUrl}/verify-email?token=${rawToken}&uid=${newUser.id}`

    sendVerificationEmail({ to: normalizedEmail, recipientName: fullName, verificationUrl }).catch(console.error)

    return NextResponse.json({ success: true, message: "Account created. Please check your email to verify." })
  } catch (err) {
    console.error("Signup failed:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
