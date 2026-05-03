"use client"

import * as React from "react"
import { apiMe, authHeaders } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { toast } from "sonner"
import ProfileEditDialog, { ProfileFormShape } from "./ProfileEditDialog"

type Role = "user" | "engineer" | "admin" | "superadmin"

type UserProfile = ProfileFormShape & {
  email: string
  role?: Role
  avatar_url: string | null
}

type UserInfoCardProps = {
  profileId?: string
  currentRole?: Role | null
}

export default function UserInfoCard({
  profileId,
  currentRole,
}: UserInfoCardProps) {
  const [open, setOpen] = React.useState(false)
  const [profile, setProfile] = React.useState<UserProfile | null>(null)
  const [currentUserId, setCurrentUserId] = React.useState<string>("")

  React.useEffect(() => {
    const loadProfile = async () => {
      const me = await apiMe()
      if (!me) return

      setCurrentUserId(me.id)
      const targetId = profileId ?? me.id

      const res = await fetch(`/api/users/${targetId}`, { headers: authHeaders() })
      if (!res.ok) {
        toast.error("Unable to load profile")
        return
      }
      const data = await res.json()
      const user = data.user ?? data

      if (!user) {
        toast.error("Unable to load profile")
        return
      }

      setProfile(user as UserProfile)
    }

    loadProfile()
  }, [profileId])

  const canEdit =
    profile &&
    (
      profile.id === currentUserId ||
      (currentRole === "superadmin" && profile.role !== "superadmin") ||
      (currentRole === "admin" &&
        (profile.role === "user" || profile.role === "engineer")) ||
      (currentRole === "engineer" && profile.role === "user")
    )

  if (!profile) return null

  const formProfile: ProfileFormShape = {
    id: profile.id,
    full_name: profile.full_name,
    employee_id: profile.employee_id,
    department: profile.department,
    designation: profile.designation,
    manager: profile.manager,
    phone: profile.phone,
    state: profile.state,
    city: profile.city,
    postal_code: profile.postal_code,
  }

  return (
    <div className="rounded-2xl border p-6">
      <div className="flex justify-between items-start gap-6">
        <div className="flex gap-4">
          <Avatar className="h-16 w-16">
            <AvatarImage src={profile.avatar_url ?? ""} />
            <AvatarFallback>{profile.full_name?.charAt(0)}</AvatarFallback>
          </Avatar>

          <div>
            <h3 className="text-lg font-semibold">{profile.full_name}</h3>
            <p className="text-sm text-muted-foreground">{profile.email}</p>
            <p className="text-sm">{profile.designation ?? "-"}</p>
          </div>
        </div>

        {canEdit && (
          <Button variant="outline" onClick={() => setOpen(true)}>
            Edit
          </Button>
        )}
      </div>

      <ProfileEditDialog
        open={open}
        onOpenChange={setOpen}
        profile={formProfile}
        onSaved={(updated) =>
          setProfile((prev) => (prev ? { ...prev, ...updated } : prev))
        }
      />
    </div>
  )
}
