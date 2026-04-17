"use client"

import * as React from "react"
import { apiMe, fetchTickets, authHeaders } from "@/lib/api"
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import TicketFilters from "@/components/tickets/TicketFilters"
import { Eye } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { timeAgo, STATUS_STYLE } from "@/lib/ticket-utils"
import { sendNotification, sendEmailNotification } from "@/lib/notify"
import { logActivity } from "@/lib/activity"

const PAGE_SIZE = 50

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
}

export default function EngineerTicketTable() {
  const router = useRouter()

  const [tickets, setTickets] = React.useState<Ticket[]>([])
  const [tab, setTab] = React.useState<"queue" | "mytask">("queue")
  const [currentUserId, setCurrentUserId] = React.useState<string | null>(null)

  const [search, setSearch] = React.useState("")
  const [status, setStatus] = React.useState("all")
  const [category, setCategory] = React.useState("all")

  const [page, setPage] = React.useState(1)
  const [hasNext, setHasNext] = React.useState(false)

  const loadTickets = React.useCallback(async () => {
    const me = await apiMe()
    if (!me) return

    setCurrentUserId(me.id)

    const params: Record<string, string> = {
      page: String(page),
      limit: String(PAGE_SIZE),
      order: "created_at:desc",
    }

    if (tab === "queue") {
      params.queue = "true"
    } else {
      params.assignee = me.id
    }

    if (status !== "all") params.status = status
    if (category !== "all") params.category = category
    if (search) params.search = search

    const data = await fetchTickets(params)
    setTickets(data as unknown as Ticket[])
    setHasNext(data.length === PAGE_SIZE)
  }, [tab, search, status, category, page])

  // Keep a ref to always call the latest loadTickets from the socket handler
  const loadTicketsRef = React.useRef(loadTickets)
  React.useEffect(() => {
    loadTicketsRef.current = loadTickets
  }, [loadTickets])

  // Effect 1: fetch data when filters/tab/page change
  React.useEffect(() => {
    loadTickets()
  }, [loadTickets])

  // Effect 2: socket listeners — set up once, never torn down on filter change
  React.useEffect(() => {
    const socket = getSocket()
    const handleUpdate = () => loadTicketsRef.current()
    socket.on("tickets:refresh", handleUpdate)
    socket.on("ticket:updated", handleUpdate)
    return () => {
      socket.off("tickets:refresh", handleUpdate)
      socket.off("ticket:updated", handleUpdate)
    }
  }, [])

  const acquireTicket = async (ticketId: string, requesterId: string) => {
    const me = await apiMe()
    if (!me) return

    const now = new Date()
    const slaResolutionAt = new Date(now.getTime() + 6 * 60 * 60 * 1000).toISOString()

    const res = await fetch(`/api/tickets/${ticketId}/acquire`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        assignee: me.id,
        status: "open",
        assigned_at: now.toISOString(),
        sla_resolution_at: slaResolutionAt,
      }),
    })

    if (!res.ok) {
      toast.error("Ticket already acquired")
    } else {
      toast.success("Ticket acquired")

      await sendNotification({
        user_id: requesterId,
        actor_id: me.id,
        ticket_id: ticketId,
        type: "acquired",
        message: `acquired your ticket #${ticketId.slice(0, 8).toUpperCase()}`,
      })

      const [requesterRes, ticketRes] = await Promise.all([
        fetch(`/api/users/${requesterId}`, { headers: authHeaders() }),
        fetch(`/api/tickets/${ticketId}`, { headers: authHeaders() }),
      ])

      const requesterData = requesterRes.ok ? (await requesterRes.json()).user : null
      const ticketData = ticketRes.ok ? (await ticketRes.json()).ticket : null

      if (requesterData?.email) {
        sendEmailNotification({
          recipient_email: requesterData.email,
          recipient_name: requesterData.full_name ?? "User",
          actor_name: me.full_name ?? "Support Engineer",
          ticket_id: ticketId,
          ticket_subject: ticketData?.subject ?? "Support Ticket",
          action: "acquired",
        })
      }

      logActivity({
        ticket_id: ticketId,
        actor_id: me.id,
        action: "acquired",
        details: { engineer_name: me.full_name ?? "Engineer" },
      })

      fetch("/api/ticket-assignments", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          ticket_id: ticketId,
          engineer_id: me.id,
          action: "acquired",
        }),
      }).catch(() => {})

      loadTickets()
    }
  }

  return (
    <Card className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Engineer Tickets</h2>

        <TicketFilters
          search={search}
          setSearch={setSearch}
          status={status}
          setStatus={setStatus}
          category={category}
          setCategory={setCategory}
        />
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(v as "queue" | "mytask")
          setPage(1)
        }}
      >
        <TabsList>
          <TabsTrigger value="queue">Queue</TabsTrigger>
          <TabsTrigger value="mytask">My Tasks</TabsTrigger>
        </TabsList>
      </Tabs>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Ticket ID</TableHead>
            <TableHead>Subject</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Requester</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Sub-Category</TableHead>
            <TableHead className="text-right">
              {tab === "queue" ? "Assign" : "Actions"}
            </TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {tickets.map((t) => (
            <TableRow key={t.id}>
              <TableCell>{t.id.slice(0, 8).toUpperCase()}</TableCell>
              <TableCell>{t.subject}</TableCell>
              <TableCell>{t.location ?? "-"}</TableCell>
              <TableCell>{t.requester_name}</TableCell>
              <TableCell>{timeAgo(t.created_at)}</TableCell>

              <TableCell>
                <Badge className={STATUS_STYLE[t.status]}>
                  {t.status.replace("_", " ").toUpperCase()}
                </Badge>
              </TableCell>

              <TableCell>{t.category ?? "-"}</TableCell>
              <TableCell>{t.sub_category ?? "-"}</TableCell>

              <TableCell className="text-right">
                {tab === "queue" ? (
                  <Button size="sm" onClick={() => acquireTicket(t.id, t.requester_id)}>
                    Acquire
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => router.push(`/ticket/${t.id}`)}
                  >
                    <Eye className="h-5 w-5" />
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
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
