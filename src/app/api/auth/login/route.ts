import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { queryOne, query } from "@/lib/db"
import { signToken } from "@/lib/auth"

export const runtime = "nodejs"

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 })
    }

    const user = await queryOne<{
      id: string; email: string; password_hash: string; full_name: string
      role: string; org_domain: string; is_verified: boolean; avatar_url: string | null
    }>(
      "SELECT id, email, password_hash, full_name, role, org_domain, is_verified, avatar_url FROM users WHERE email = $1",
      [email.toLowerCase().trim()]
    )

    if (!user) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 })
    }

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 })
    }

    if (!user.is_verified) {
      return NextResponse.json({ error: "EMAIL_NOT_VERIFIED", needsVerification: true }, { status: 403 })
    }

    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      orgDomain: user.org_domain,
    })

    const { password_hash: _, ...safeUser } = user

    return NextResponse.json({ token, user: safeUser })
  } catch (err) {
    console.error("Login failed:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
