import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { queryOne, withTransaction } from "@/lib/db"

export const runtime = "nodejs"

export async function POST(req: Request) {
  try {
    const user = await requireAuth(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    if (user.role !== "admin" && user.role !== "superadmin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { target_user_id } = await req.json()
    if (!target_user_id) {
      return NextResponse.json({ error: "Missing target_user_id" }, { status: 400 })
    }

    if (target_user_id === user.id) {
      return NextResponse.json({ error: "Cannot delete yourself" }, { status: 400 })
    }

    const targetUser = await queryOne<{ role: string; org_domain: string | null }>(
      "SELECT role, org_domain FROM users WHERE id=$1",
      [target_user_id]
    )

    if (!targetUser) return NextResponse.json({ error: "User not found" }, { status: 404 })

    if (targetUser.role === "admin" || targetUser.role === "superadmin") {
      return NextResponse.json(
        { error: "Cannot delete admin or superadmin accounts" },
        { status: 403 }
      )
    }

    // Admin can only delete users in their own organization
    if (user.role === "admin" && targetUser.org_domain !== user.org_domain) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Foreign keys to users(id) are NOT ON DELETE CASCADE / SET NULL,
    // so we have to clean them up manually inside a single transaction.
    await withTransaction(async (c) => {
      // Tickets the user raised → keep the ticket, sever the link.
      // (requester_name is stored as text on the ticket, so history is preserved.)
      await c.query(
        "UPDATE tickets SET requester_id = NULL WHERE requester_id = $1",
        [target_user_id]
      )

      // Tickets assigned to the user → send back to the queue.
      await c.query(
        `UPDATE tickets
            SET assignee = NULL,
                assigned_at = NULL,
                status = CASE WHEN status IN ('open','in_progress') THEN 'new' ELSE status END
          WHERE assignee = $1`,
        [target_user_id]
      )

      // Activity / messages / notification actor → nullify (preserves history).
      await c.query(
        "UPDATE ticket_activity SET actor_id = NULL WHERE actor_id = $1",
        [target_user_id]
      )
      await c.query(
        "UPDATE ticket_messages SET sender_id = NULL WHERE sender_id = $1",
        [target_user_id]
      )
      await c.query(
        "UPDATE notifications SET actor_id = NULL WHERE actor_id = $1",
        [target_user_id]
      )

      // Audit-log style tables → just drop the rows.
      await c.query(
        "DELETE FROM ticket_assignments WHERE engineer_id = $1",
        [target_user_id]
      )

      // Asset references.
      await c.query(
        "UPDATE assets SET assigned_to = NULL WHERE assigned_to = $1",
        [target_user_id]
      )
      await c.query(
        "DELETE FROM asset_assignments WHERE user_id = $1",
        [target_user_id]
      )

      // notifications.user_id and user_organization_access.user_id already
      // ON DELETE CASCADE, so the final delete cleans those up.
      await c.query("DELETE FROM users WHERE id = $1", [target_user_id])
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("User delete failed:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
