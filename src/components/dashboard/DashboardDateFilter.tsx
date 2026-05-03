"use client"

import * as React from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export type DateRangePreset = "1d" | "7d" | "1m" | "1y" | "all" | "custom"

export type DateRange = {
  preset: DateRangePreset
  from: string | null   // ISO; null = no lower bound
  to: string | null     // ISO; null = no upper bound
}

export const DEFAULT_RANGE: DateRange = {
  preset: "7d",
  from: presetToFromISO("7d"),
  to: null,
}

export function presetToFromISO(preset: DateRangePreset): string | null {
  if (preset === "all" || preset === "custom") return null
  const d = new Date()
  if (preset === "1d") d.setDate(d.getDate() - 1)
  if (preset === "7d") d.setDate(d.getDate() - 7)
  if (preset === "1m") d.setMonth(d.getMonth() - 1)
  if (preset === "1y") d.setFullYear(d.getFullYear() - 1)
  return d.toISOString()
}

type Props = {
  value: DateRange
  onChange: (range: DateRange) => void
}

export default function DashboardDateFilter({ value, onChange }: Props) {
  const handlePreset = (preset: DateRangePreset) => {
    if (preset === "custom") {
      onChange({ preset, from: value.from, to: value.to })
      return
    }
    onChange({ preset, from: presetToFromISO(preset), to: null })
  }

  const dateInputValue = (iso: string | null) => {
    if (!iso) return ""
    const d = new Date(iso)
    if (isNaN(d.getTime())) return ""
    return d.toISOString().slice(0, 10)
  }

  const handleCustom = (key: "from" | "to", v: string) => {
    if (!v) {
      onChange({ ...value, preset: "custom", [key]: null })
      return
    }
    const d = new Date(v + (key === "to" ? "T23:59:59.999Z" : "T00:00:00.000Z"))
    onChange({ ...value, preset: "custom", [key]: d.toISOString() })
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <Label className="text-xs text-muted-foreground">Range</Label>
        <Select value={value.preset} onValueChange={(v) => handlePreset(v as DateRangePreset)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1d">Last 1 day</SelectItem>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="1m">Last 1 month</SelectItem>
            <SelectItem value="1y">Last 1 year</SelectItem>
            <SelectItem value="all">All time</SelectItem>
            <SelectItem value="custom">Custom</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {value.preset === "custom" && (
        <>
          <div>
            <Label className="text-xs text-muted-foreground">From</Label>
            <Input
              type="date"
              className="w-[160px]"
              value={dateInputValue(value.from)}
              onChange={(e) => handleCustom("from", e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">To</Label>
            <Input
              type="date"
              className="w-[160px]"
              value={dateInputValue(value.to)}
              onChange={(e) => handleCustom("to", e.target.value)}
            />
          </div>
        </>
      )}
    </div>
  )
}
