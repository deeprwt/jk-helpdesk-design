"use client"

import * as React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { TrendingUp } from "lucide-react"
import { apiMe, fetchTickets } from "@/lib/api"
import type { DateRange } from "@/components/dashboard/DashboardDateFilter"

type Role = "user" | "engineer" | "admin" | "superadmin"

type OverviewStat = {
  label: string
  value: number
}

type Props = {
  dateRange?: DateRange
}

export default function TicketOverviewCards({ dateRange }: Props) {
  const [stats, setStats] = React.useState<OverviewStat[]>([])
  const [loading, setLoading] = React.useState(true)

  const from = dateRange?.from ?? null
  const to = dateRange?.to ?? null

  React.useEffect(() => {
    let mounted = true

    const loadStats = async () => {
      setLoading(true)

      const me = await apiMe()
      if (!mounted) return
      if (!me) { setLoading(false); return }

      const role = me.role as Role

      const params: Record<string, string> = {}
      if (from) params.from = from
      if (to) params.to = to

      if (role === "user") {
        params.requester_id = me.id
        const tickets = await fetchTickets(params)
        if (!mounted) return
        setStats([
          { label: "Total Tickets", value: tickets.length },
          { label: "New Tickets", value: tickets.filter((t) => t.status === "new").length },
          { label: "Open Tickets", value: tickets.filter((t) => t.status === "open").length },
          { label: "Hold Tickets", value: tickets.filter((t) => t.status === "hold").length },
          { label: "Closed Tickets", value: tickets.filter((t) => t.status === "closed").length },
        ])
      } else {
        const allTickets = await fetchTickets(params)
        if (!mounted) return
        const total = allTickets.length
        const queueNew = allTickets.filter((t) => t.status === "new" && !t.assignee).length
        const openAssigned = allTickets.filter((t) => t.status === "open").length
        const hold = allTickets.filter((t) => t.status === "hold").length
        const closed = allTickets.filter((t) => t.status === "closed").length

        setStats([
          { label: "Total Tickets", value: total },
          { label: "New in Queue", value: queueNew },
          { label: "Open (Assigned)", value: openAssigned },
          { label: "Hold Tickets", value: hold },
          { label: "Closed (Resolved)", value: closed },
        ])
      }

      if (mounted) setLoading(false)
    }

    loadStats()
    return () => { mounted = false }
  }, [from, to])

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i} className="p-5">
            <Skeleton className="h-5 w-24 mb-2" />
            <Skeleton className="h-8 w-16" />
          </Card>
        ))}
      </div>
    )
  }

  if (stats.length === 0) return null

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
      {stats.map((stat) => (
        <Card key={stat.label} className="p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{stat.label}</p>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100">
              <TrendingUp className="h-5 w-5 text-green-600" />
            </span>
          </div>

          <CardContent className="p-0 mt-2">
            <h3 className="text-3xl font-bold">{stat.value}</h3>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
