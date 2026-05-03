"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { apiMe, fetchTickets } from "@/lib/api"
import { getSocket } from "@/lib/socket"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import TicketFilters from "@/components/tickets/TicketFilters"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Download, Eye } from "lucide-react"
import { timeAgo, STATUS_STYLE } from "@/lib/ticket-utils"
import type { DateRange } from "@/components/dashboard/DashboardDateFilter"
import { authHeaders } from "@/lib/api"
import { toast } from "sonner"

type Organization = { id: string; name: string; domain: string }

const PAGE_SIZE = 50

type Role = "admin" | "superadmin"

type Ticket = {
  id: string
  subject: string
  location: string | null
  requester_id: string
  requester_name: string
  created_at: string
  status: string
  category: string | null
  sub_category: string | null
  assignee: string | null
  assignee_full_name: string | null
  org_domain: string | null
}

type Props = {
  role: Role
  dateRange?: DateRange
}

export default function AdminTicketTable({ role, dateRange }: Props) {
  const router = useRouter()

  const [tickets, setTickets] = React.useState<Ticket[]>([])
  const [search, setSearch] = React.useState("")
  const [status, setStatus] = React.useState("all")
  const [category, setCategory] = React.useState("all")
  const [page, setPage] = React.useState(1)
  const [hasNext, setHasNext] = React.useState(false)

  const [orgs, setOrgs] = React.useState<Organization[]>([])
  const [orgDomain, setOrgDomain] = React.useState<string>("all")

  const isSuperAdmin = role === "superadmin"
  const from = dateRange?.from ?? null
  const to = dateRange?.to ?? null

  React.useEffect(() => {
    if (!isSuperAdmin) return
    let cancelled = false
    fetch("/api/organizations", { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : { organizations: [] }))
      .then((d) => {
        if (cancelled) return
        setOrgs((d.organizations ?? []) as Organization[])
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [isSuperAdmin])

  const loadTickets = React.useCallback(async () => {
    const me = await apiMe()
    if (!me) return

    const params: Record<string, string> = {
      page: String(page),
      limit: String(PAGE_SIZE),
      order: "created_at:desc",
    }

    if (status !== "all") params.status = status
    if (category !== "all") params.category = category
    if (search) params.search = search
    if (from) params.from = from
    if (to) params.to = to
    if (isSuperAdmin && orgDomain !== "all") params.org_domain = orgDomain

    const data = await fetchTickets(params)
    setTickets(data as unknown as Ticket[])
    setHasNext(data.length === PAGE_SIZE)
  }, [search, status, category, page, from, to, isSuperAdmin, orgDomain])

  const loadTicketsRef = React.useRef(loadTickets)
  React.useEffect(() => {
    loadTicketsRef.current = loadTickets
  }, [loadTickets])

  React.useEffect(() => {
    loadTickets()
  }, [loadTickets])

  React.useEffect(() => {
    const socket = getSocket()
    if (!socket) return
    const handleUpdate = () => loadTicketsRef.current()
    socket.on("tickets:refresh", handleUpdate)
    socket.on("ticket:updated", handleUpdate)
    return () => {
      socket.off("tickets:refresh", handleUpdate)
      socket.off("ticket:updated", handleUpdate)
    }
  }, [])

  const [exporting, setExporting] = React.useState(false)
  const handleExport = async () => {
    setExporting(true)
    try {
      const qs = new URLSearchParams()
      if (status !== "all") qs.set("status", status)
      if (category !== "all") qs.set("category", category)
      if (search) qs.set("search", search)
      if (from) qs.set("from", from)
      if (to) qs.set("to", to)
      if (isSuperAdmin && orgDomain !== "all") qs.set("org_domain", orgDomain)

      const res = await fetch(`/api/tickets/export?${qs.toString()}`, {
        headers: authHeaders(),
      })

      if (!res.ok) {
        toast.error("Failed to export tickets")
        return
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      const stamp = new Date().toISOString().slice(0, 10)
      const orgPart =
        isSuperAdmin && orgDomain !== "all" ? `-${orgDomain}` : ""
      a.download = `tickets${orgPart}-${stamp}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  return (
    <Card className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold">All Tickets</h2>
          <p className="text-sm text-muted-foreground">
            {isSuperAdmin
              ? "Tickets across all organizations"
              : "Tickets for your organization"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {isSuperAdmin && (
            <Select
              value={orgDomain}
              onValueChange={(v) => {
                setOrgDomain(v)
                setPage(1)
              }}
            >
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Organization" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All organizations</SelectItem>
                {orgs.map((o) => (
                  <SelectItem key={o.id} value={o.domain}>
                    {o.name} ({o.domain})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <TicketFilters
            search={search}
            setSearch={setSearch}
            status={status}
            setStatus={setStatus}
            category={category}
            setCategory={setCategory}
          />

          <Button
            variant="outline"
            onClick={handleExport}
            disabled={exporting}
            className="whitespace-nowrap"
          >
            <Download className="mr-2 h-4 w-4" />
            {exporting ? "Exporting..." : "Export CSV"}
          </Button>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Ticket ID</TableHead>
            <TableHead>Subject</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Requester</TableHead>
            <TableHead>Assignee</TableHead>
            {isSuperAdmin && <TableHead>Organization</TableHead>}
            <TableHead>Created</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Sub-Category</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {tickets.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={isSuperAdmin ? 11 : 10}
                className="text-center text-muted-foreground py-8"
              >
                No tickets found.
              </TableCell>
            </TableRow>
          ) : (
            tickets.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">
                  {t.id.slice(0, 8).toUpperCase()}
                </TableCell>
                <TableCell>{t.subject}</TableCell>
                <TableCell>{t.location ?? "-"}</TableCell>
                <TableCell>{t.requester_name ?? "-"}</TableCell>
                <TableCell>{t.assignee_full_name ?? "-"}</TableCell>
                {isSuperAdmin && (
                  <TableCell>{t.org_domain ?? "-"}</TableCell>
                )}
                <TableCell className="text-muted-foreground">
                  {timeAgo(t.created_at)}
                </TableCell>
                <TableCell>
                  <Badge className={STATUS_STYLE[t.status]}>
                    {t.status.replace("_", " ").toUpperCase()}
                  </Badge>
                </TableCell>
                <TableCell>{t.category ?? "-"}</TableCell>
                <TableCell>{t.sub_category ?? "-"}</TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => router.push(`/ticket/${t.id}`)}
                    title="View ticket"
                  >
                    <Eye className="h-5 w-5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          disabled={page === 1}
          onClick={() => setPage((p) => p - 1)}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          disabled={!hasNext}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </Button>
      </div>
    </Card>
  )
}
