"use client"

import * as React from "react"
import { apiMe, authHeaders } from "@/lib/api"
import ProfileEditDialog, {
  ProfileFormShape,
  isProfileComplete,
} from "./ProfileEditDialog"

export default function ProfileSetupGate() {
  const [profile, setProfile] = React.useState<ProfileFormShape | null>(null)
  const [open, setOpen] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false

    const check = async () => {
      const me = await apiMe()
      if (!me || cancelled) return

      const res = await fetch(`/api/users/${me.id}`, { headers: authHeaders() })
      if (!res.ok || cancelled) return

      const data = await res.json()
      const user = data.user ?? data
      const shape: ProfileFormShape = {
        id: user.id,
        full_name: user.full_name ?? null,
        employee_id: user.employee_id ?? null,
        department: user.department ?? null,
        designation: user.designation ?? null,
        manager: user.manager ?? null,
        phone: user.phone ?? null,
        state: user.state ?? null,
        city: user.city ?? null,
        postal_code: user.postal_code ?? null,
      }

      if (cancelled) return
      setProfile(shape)
      if (!isProfileComplete(shape)) setOpen(true)
    }

    check()
    return () => {
      cancelled = true
    }
  }, [])

  if (!profile) return null

  return (
    <ProfileEditDialog
      open={open}
      onOpenChange={setOpen}
      profile={profile}
      forceComplete
      onSaved={(updated) => {
        setProfile(updated)
        if (isProfileComplete(updated)) setOpen(false)
      }}
    />
  )
}
