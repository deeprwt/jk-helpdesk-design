"use client"

import * as React from "react"
import { apiMe } from "@/lib/api"
import EngineerTicketTable from "@/components/tickets/EngineerTicketTable"
import AdminTicketTable from "@/components/tickets/AdminTicketTable"
import UserLatestTickets from "@/components/tickets/UserLatestTickets"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import type { DateRange } from "@/components/dashboard/DashboardDateFilter"

type Role = "user" | "engineer" | "admin" | "superadmin"

type Props = {
  dateRange?: DateRange
}

export default function RoleBasedTickets({ dateRange }: Props) {
  const [role, setRole] = React.useState<Role | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    const loadRole = async () => {
      try {
        const me = await apiMe()
        setRole((me?.role ?? "user") as Role)
      } finally {
        setLoading(false)
      }
    }

    loadRole()
  }, [])

  if (loading) {
    return (
      <Card className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-9 w-64" />
        </div>

        <div className="flex gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-24" />
        </div>

        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>

        <div className="flex justify-end gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-24" />
        </div>
      </Card>
    )
  }

  if (role === "user") return <UserLatestTickets />
  if (role === "engineer") return <EngineerTicketTable />
  if (role === "admin" || role === "superadmin") {
    return <AdminTicketTable role={role} dateRange={dateRange} />
  }

  return null
}
