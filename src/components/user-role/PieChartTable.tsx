"use client"

import * as React from "react"
import { Pie, PieChart } from "recharts"
import { apiMe, fetchTickets } from "@/lib/api"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import { Skeleton } from "@/components/ui/skeleton"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

import type { DateRange } from "@/components/dashboard/DashboardDateFilter"

type UserRole = "user" | "engineer" | "admin" | "superadmin"

type ChartRow = {
  key: string
  label: string
  value: number
  fill: string
}

const COLORS = {
  total: "var(--chart-1)",
  new: "var(--chart-2)",
  open: "var(--chart-3)",
  hold: "var(--chart-4)",
  closed: "var(--chart-5)",
}

const chartConfig = {
  value: { label: "Tickets" },
  total: { label: "Total Tickets", color: COLORS.total },
  new: { label: "New Tickets", color: COLORS.new },
  open: { label: "Open Tickets", color: COLORS.open },
  hold: { label: "Hold Tickets", color: COLORS.hold },
  closed: { label: "Closed Tickets", color: COLORS.closed },
} satisfies ChartConfig

type Props = {
  dateRange?: DateRange
}

export function PieChartTable({ dateRange }: Props) {
  const [data, setData] = React.useState<ChartRow[]>([])
  const [role, setRole] = React.useState<UserRole | null>(null)
  const [ready, setReady] = React.useState(false)
  const [loading, setLoading] = React.useState(true)

  const from = dateRange?.from ?? null
  const to = dateRange?.to ?? null

  React.useEffect(() => {
    let mounted = true

    const load = async () => {
      const me = await apiMe()
      if (!mounted) return
      if (!me) { setReady(true); return }

      setRole(me.role as UserRole)
      if (me.role === "user") { setReady(true); return }

      setLoading(true)

      const params: Record<string, string> = {}
      if (from) params.from = from
      if (to) params.to = to

      const tickets = await fetchTickets(params)
      if (!mounted) return

      setData([
        { key: "total", label: "Total Tickets", value: tickets.length, fill: COLORS.total },
        { key: "new", label: "New Tickets (Queue)", value: tickets.filter((t) => t.status === "new" && !t.assignee).length, fill: COLORS.new },
        { key: "open", label: "Open Tickets", value: tickets.filter((t) => t.status === "open").length, fill: COLORS.open },
        { key: "hold", label: "Hold Tickets", value: tickets.filter((t) => t.status === "hold").length, fill: COLORS.hold },
        { key: "closed", label: "Closed Tickets", value: tickets.filter((t) => t.status === "closed").length, fill: COLORS.closed },
      ])

      setLoading(false)
      setReady(true)
    }

    load()
    return () => { mounted = false }
  }, [from, to])

  if (!ready || role === "user") return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ticket Overview</CardTitle>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-4/6" />
            </div>
            <Skeleton className="w-[260px] h-[260px] rounded-full mx-auto" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div className="space-y-3">
              {data.map((item) => (
                <div key={item.key} className="flex items-center gap-3 text-sm">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: item.fill }}
                  />
                  <span className="flex-1">{item.label}</span>
                  <span className="font-semibold">{item.value}</span>
                </div>
              ))}
            </div>

            {data.every((d) => d.value === 0) ? (
              <div className="w-[260px] h-[260px] mx-auto flex items-center justify-center">
                <svg width="260" height="260" viewBox="0 0 260 260">
                  <circle
                    cx="130" cy="130" r="90"
                    fill="none"
                    stroke="var(--border, #e5e7eb)"
                    strokeWidth="40"
                  />
                  <text x="130" y="135" textAnchor="middle" dominantBaseline="middle"
                    className="fill-muted-foreground" fontSize="13" fill="#9ca3af">
                    No data
                  </text>
                </svg>
              </div>
            ) : (
              <ChartContainer
                config={chartConfig}
                className="w-[260px] h-[260px] mx-auto"
              >
                <PieChart width={260} height={260}>
                  <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                  <Pie
                    data={data}
                    dataKey="value"
                    nameKey="label"
                    innerRadius={70}
                    outerRadius={110}
                    paddingAngle={2}
                  />
                </PieChart>
              </ChartContainer>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
