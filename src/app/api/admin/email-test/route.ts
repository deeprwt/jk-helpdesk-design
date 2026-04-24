import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { sendTestEmail } from "@/lib/email"

export const runtime = "nodejs"

export async function POST(req: Request) {
  try {
    const user = await requireAuth(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (user.role !== "superadmin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = (await req.json().catch(() => ({}))) as {
      to?: string
      subject?: string
      message?: string
    }

    const to = body.to?.trim()
    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      return NextResponse.json(
        { error: "Valid recipient email is required" },
        { status: 400 }
      )
    }

    const result = await sendTestEmail({
      to,
      subject: body.subject,
      message: body.message,
      actorName: user.full_name || user.email,
    })

    return NextResponse.json(result, { status: result.ok ? 200 : 502 })
  } catch (err) {
    console.error("Email test failed:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
