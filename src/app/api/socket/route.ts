import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"

export const runtime = "nodejs"

export async function POST(req: Request) {
  try {
    const user = await requireAuth(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { event, payload, room } = await req.json()

    const io = (global as Record<string, unknown>)["_io"] as {
      to: (r: string) => { emit: (e: string, d: unknown) => void }
      emit: (e: string, d: unknown) => void
    } | undefined

    if (!io) return NextResponse.json({ error: "Socket.IO not initialized" }, { status: 503 })

    if (room) {
      io.to(room).emit(event, payload)
    } else {
      io.emit(event, payload)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Socket emit failed:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
