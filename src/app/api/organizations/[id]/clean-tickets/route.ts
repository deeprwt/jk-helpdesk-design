import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { query, queryOne } from "@/lib/db"

export const runtime = "nodejs"

async function loadOrg(id: string) {
  return queryOne<{ id: string; name: string; domain: string }>(
    "SELECT id, name, domain FROM organizations WHERE id = $1",
    [id]
  )
}

/* ── Preview: how many tickets would be deleted ─────────── */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (user.role !== "superadmin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id } = await params
    const org = await loadOrg(id)
    if (!org) return NextResponse.json({ error: "Organization not found" }, { status: 404 })

    const row = await queryOne<{ count: number }>(
      "SELECT COUNT(id)::int AS count FROM tickets WHERE LOWER(org_domain) = LOWER($1)",
      [org.domain]
    )

    return NextResponse.json({
      organization: { id: org.id, name: org.name, domain: org.domain },
      ticket_count: row?.count ?? 0,
    })
  } catch (err) {
    console.error("Clean-tickets preview failed:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/* ── Execute: wipe all tickets for this org ─────────────── */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (user.role !== "superadmin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id } = await params
    const org = await loadOrg(id)
    if (!org) return NextResponse.json({ error: "Organization not found" }, { status: 404 })

    // Safety: body must confirm the org domain exactly (case-insensitive)
    const body = await req.json().catch(() => ({})) as { confirm_domain?: string }
    const confirm = (body.confirm_domain ?? "").trim().toLowerCase()
    if (confirm !== org.domain.toLowerCase()) {
      return NextResponse.json(
        { error: "Confirmation domain does not match" },
        { status: 400 }
      )
    }

    // Child tables (ticket_messages, ticket_attachments, ticket_activity,
    // ticket_assignments, asset_tickets, notifications.ticket_id) all cascade
    // on ticket delete, so a single DELETE handles everything.
    const deleted = await query<{ id: string }>(
      "DELETE FROM tickets WHERE LOWER(org_domain) = LOWER($1) RETURNING id",
      [org.domain]
    )

    console.log(
      `[CLEAN-TICKETS] org=${org.domain} by=${user.email} deleted=${deleted.length}`
    )

    return NextResponse.json({
      success: true,
      deleted_count: deleted.length,
      organization: { id: org.id, name: org.name, domain: org.domain },
    })
  } catch (err) {
    console.error("Clean-tickets failed:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
