"use client"

import * as React from "react"
import TicketOverviewCards from "@/components/tickets/TicketOverviewCards"
import RoleBasedTickets from "@/components/user-role/RoleBasedTickets"
import TeammatesCard from "@/components/user-role/TeammatesCard"
import { PieChartTable } from "@/components/user-role/PieChartTable"
import DashboardDateFilter, {
  DEFAULT_RANGE,
  type DateRange,
} from "@/components/dashboard/DashboardDateFilter"
import { apiMe } from "@/lib/api"

export default function DashboardOverview() {
  const [dateRange, setDateRange] = React.useState<DateRange>(DEFAULT_RANGE)
  const [role, setRole] = React.useState<string | null>(null)

  React.useEffect(() => {
    apiMe().then((me) => setRole(me?.role ?? null))
  }, [])

  const showFilter = role && role !== "user"

  return (
    <div className="grid grid-cols-12 gap-4 md:gap-6">
      {showFilter && (
        <div className="col-span-12 flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">Overview</h2>
          <DashboardDateFilter value={dateRange} onChange={setDateRange} />
        </div>
      )}

      <div className="col-span-12">
        <TicketOverviewCards dateRange={dateRange} />
      </div>

      <div className="col-span-12 xl:col-span-5">
        <TeammatesCard />
      </div>

      <div className="col-span-12 xl:col-span-7">
        <PieChartTable dateRange={dateRange} />
      </div>

      <div className="col-span-12">
        <RoleBasedTickets dateRange={dateRange} />
      </div>
    </div>
  )
}
