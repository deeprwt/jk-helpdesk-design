"use client"

import * as React from "react"
import { authHeaders } from "@/lib/api"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"

export type ProfileFormShape = {
  id: string
  full_name: string | null
  employee_id: string | null
  department: string | null
  designation: string | null
  manager: string | null
  phone: string | null
  state: string | null
  city: string | null
  postal_code: string | null
}

export const STATE_OPTIONS = ["Delhi", "Chhattisgarh", "Uttar Pradesh"] as const
export const CITY_OPTIONS = ["Delhi HO", "Surajpur", "Gajraula"] as const

const REQUIRED_FIELDS: (keyof ProfileFormShape)[] = [
  "full_name",
  "employee_id",
  "department",
  "designation",
  "manager",
  "phone",
  "state",
  "city",
  "postal_code",
]

export function isProfileComplete(p: Partial<ProfileFormShape> | null | undefined) {
  if (!p) return false
  return REQUIRED_FIELDS.every((k) => {
    const v = p[k]
    return typeof v === "string" && v.trim().length > 0
  })
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  profile: ProfileFormShape
  forceComplete?: boolean
  onSaved?: (updated: ProfileFormShape) => void
}

export default function ProfileEditDialog({
  open,
  onOpenChange,
  profile,
  forceComplete = false,
  onSaved,
}: Props) {
  const [form, setForm] = React.useState<ProfileFormShape>(profile)
  const [errors, setErrors] = React.useState<Partial<Record<keyof ProfileFormShape, string>>>({})
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      setForm(profile)
      setErrors({})
    }
  }, [open, profile])

  const setField = <K extends keyof ProfileFormShape>(key: K, value: ProfileFormShape[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  const validate = () => {
    const next: Partial<Record<keyof ProfileFormShape, string>> = {}
    for (const k of REQUIRED_FIELDS) {
      const v = form[k]
      if (typeof v !== "string" || v.trim() === "") {
        next[k] = "Required"
      }
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSave = async () => {
    if (!validate()) {
      toast.error("Please fill all required fields")
      return
    }

    setSaving(true)
    const res = await fetch(`/api/users/${form.id}`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({
        full_name: form.full_name,
        employee_id: form.employee_id,
        department: form.department,
        designation: form.designation,
        manager: form.manager,
        phone: form.phone,
        state: form.state,
        city: form.city,
        postal_code: form.postal_code,
      }),
    })
    setSaving(false)

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      toast.error(err.error ?? "Failed to update profile")
      return
    }

    toast.success("Profile updated successfully")
    onSaved?.(form)
    if (!forceComplete) onOpenChange(false)
  }

  const handleOpenChange = (next: boolean) => {
    if (forceComplete && !next) return
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-3xl"
        showCloseButton={!forceComplete}
        onEscapeKeyDown={(e) => {
          if (forceComplete) e.preventDefault()
        }}
        onPointerDownOutside={(e) => {
          if (forceComplete) e.preventDefault()
        }}
        onInteractOutside={(e) => {
          if (forceComplete) e.preventDefault()
        }}
      >
        <DialogHeader>
          <DialogTitle>
            {forceComplete ? "Complete Your Profile" : "Edit Profile"}
          </DialogTitle>
          {forceComplete && (
            <DialogDescription>
              Please fill in all required details to continue using the helpdesk.
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            label="Full Name"
            required
            value={form.full_name ?? ""}
            error={errors.full_name}
            onChange={(v) => setField("full_name", v)}
          />
          <TextField
            label="Employee ID"
            required
            value={form.employee_id ?? ""}
            error={errors.employee_id}
            onChange={(v) => setField("employee_id", v)}
          />
          <TextField
            label="Department"
            required
            value={form.department ?? ""}
            error={errors.department}
            onChange={(v) => setField("department", v)}
          />
          <TextField
            label="Designation"
            required
            value={form.designation ?? ""}
            error={errors.designation}
            onChange={(v) => setField("designation", v)}
          />
          <TextField
            label="Manager"
            required
            value={form.manager ?? ""}
            error={errors.manager}
            onChange={(v) => setField("manager", v)}
          />
          <TextField
            label="Phone Number"
            required
            value={form.phone ?? ""}
            error={errors.phone}
            onChange={(v) => setField("phone", v)}
          />

          <SelectField
            label="State"
            required
            placeholder="Select state"
            value={form.state ?? ""}
            options={STATE_OPTIONS as unknown as string[]}
            error={errors.state}
            onChange={(v) => setField("state", v)}
          />
          <SelectField
            label="City"
            required
            placeholder="Select city"
            value={form.city ?? ""}
            options={CITY_OPTIONS as unknown as string[]}
            error={errors.city}
            onChange={(v) => setField("city", v)}
          />

          <TextField
            label="Postal Code"
            required
            value={form.postal_code ?? ""}
            error={errors.postal_code}
            onChange={(v) => setField("postal_code", v)}
          />
        </div>

        <DialogFooter>
          {!forceComplete && (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          )}
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function TextField({
  label,
  value,
  onChange,
  required,
  error,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  required?: boolean
  error?: string
}) {
  return (
    <div>
      <Label>
        {label}
        {required && <span className="text-red-500"> *</span>}
      </Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
      />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}

function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
  required,
  error,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: string[]
  placeholder?: string
  required?: boolean
  error?: string
}) {
  return (
    <div>
      <Label>
        {label}
        {required && <span className="text-red-500"> *</span>}
      </Label>
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger aria-invalid={!!error} className="w-full">
          <SelectValue placeholder={placeholder ?? "Select"} />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt} value={opt}>
              {opt}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}
