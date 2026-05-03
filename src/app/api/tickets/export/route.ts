import { requireAuth } from "@/lib/auth"
import { query } from "@/lib/db"

export const runtime = "nodejs"

type TicketRow = {
  id: string
  subject: string
  status: string
  priority: string | null
  category: string | null
  sub_category: string | null
  location: string | null
  requester_id: string | null
  requester_name: string | null
  contact: string | null
  assignee: string | null
  assignee_full_name: string | null
  org_domain: string | null
  created_at: string
  assigned_at: string | null
  sla_response_at: string | null
  sla_resolution_at: string | null
}

const HEADERS = [
  "Ticket ID",
  "Subject",
  "Status",
  "Priority",
  "Category",
  "Sub-Category",
  "Location",
  "Requester",
  "Contact",
  "Assignee",
  "Organization",
  "Created At",
  "Assigned At",
  "SLA Response At",
  "SLA Resolution At",
]

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return ""
  const s = String(value)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export async function GET(req: Request) {
  try {
    const user = await requireAuth(req)
    if (!user) return new Response("Unauthorized", { status: 401 })

    const { searchParams } = new URL(req.url)
    const status = searchParams.get("status")
    const category = searchParams.get("category")
    const search = searchParams.get("search")
    const from = searchParams.get("from")
    const to = searchParams.get("to")
    const orgDomain = searchParams.get("org_domain")

    let sql = `
      SELECT t.id, t.subject, t.status, t.priority, t.category, t.sub_category,
             t.location, t.requester_id, t.requester_name, t.contact,
             t.assignee, a.full_name AS assignee_full_name,
             t.org_domain, t.created_at, t.assigned_at,
             t.sla_response_at, t.sla_resolution_at
        FROM tickets t
        LEFT JOIN users a ON a.id = t.assignee
       WHERE 1=1`

    const params: unknown[] = []
    let idx = 1

    // Same role-based scoping as /api/tickets
    if (user.role === "user") {
      sql += ` AND t.requester_id = $${idx++}`
      params.push(user.id)
    } else if (user.role === "engineer") {
      sql += ` AND t.org_domain = $${idx++}`
      params.push(user.org_domain)
    } else if (user.role !== "superadmin") {
      sql += ` AND t.org_domain = $${idx++}`
      params.push(user.org_domain)
    }

    if (status && status !== "all") {
      sql += ` AND t.status = $${idx++}`
      params.push(status)
    }
    if (category && category !== "all") {
      sql += ` AND t.category = $${idx++}`
      params.push(category)
    }
    if (search) {
      sql += ` AND (t.subject ILIKE $${idx} OR t.requester_name ILIKE $${idx} OR t.location ILIKE $${idx})`
      params.push(`%${search}%`)
      idx++
    }
    if (from) {
      sql += ` AND t.created_at >= $${idx++}`
      params.push(from)
    }
    if (to) {
      sql += ` AND t.created_at <= $${idx++}`
      params.push(to)
    }
    if (orgDomain && user.role === "superadmin") {
      sql += ` AND t.org_domain = $${idx++}`
      params.push(orgDomain)
    }

    sql += ` ORDER BY t.created_at DESC`

    const rows = await query<TicketRow>(sql, params)

    const lines: string[] = [HEADERS.join(",")]
    for (const r of rows) {
      lines.push(
        [
          r.id.slice(0, 8).toUpperCase(),
          r.subject,
          r.status,
          r.priority,
          r.category,
          r.sub_category,
          r.location,
          r.requester_name,
          r.contact,
          r.assignee_full_name,
          r.org_domain,
          r.created_at,
          r.assigned_at,
          r.sla_response_at,
          r.sla_resolution_at,
        ]
          .map(csvEscape)
          .join(",")
      )
    }

    // Prepend BOM so Excel treats UTF-8 properly
    const body = "﻿" + lines.join("\r\n")

    const stamp = new Date().toISOString().slice(0, 10)
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="tickets-${stamp}.csv"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (err) {
    console.error("Ticket export failed:", err)
    return new Response("Internal server error", { status: 500 })
  }
}
