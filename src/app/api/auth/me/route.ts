import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"

export const runtime = "nodejs"

export async function GET(req: Request) {
  const user = await requireAuth(req)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  return NextResponse.json({ user })
}
