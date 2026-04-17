"use client"

import * as React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { TrendingUp } from "lucide-react"
import { fetchTickets } from "@/lib/api"

type OverviewStat = {
  label: string
  value: number
}

type Props = {
  userId: string
}

export function UserTicketOverviewById({ userId }: Props) {
  const [stats, setStats] = React.useState<OverviewStat[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    if (!userId) return

    const loadStats = async () => {
      setLoading(true)

      // Fetch all tickets for this user from the API
      const tickets = await fetchTickets({ requester_id: userId })

      const total = tickets.length
      const newTickets = tickets.filter((t) => t.status === "new").length
      const openTickets = tickets.filter((t) => t.status === "open").length
      const holdTickets = tickets.filter((t) => t.status === "hold").length
      const closedTickets = tickets.filter((t) => t.status === "closed").length

      setStats([
        { label: "Total Tickets", value: total },
        { label: "New Tickets", value: newTickets },
        { label: "Open Tickets", value: openTickets },
        { label: "Hold Tickets", value: holdTickets },
        { label: "Closed Tickets", value: closedTickets },
      ])

      setLoading(false)
    }

    loadStats()
  }, [userId])

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

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
      {stats.map((stat) => (
        <Card key={stat.label} className="p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {stat.label}
            </p>
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
