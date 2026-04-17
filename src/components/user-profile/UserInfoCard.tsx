"use client"

import * as React from "react"
import { apiMe, fetchUser, authHeaders } from "@/lib/api"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { toast } from "sonner"

/* ---------------- TYPES ---------------- */

type Role = "user" | "engineer" | "admin" | "superadmin"

type UserProfile = {
  id: string
  email: string
  role?: Role
  full_name: string
  employee_id: string | null
  designation: string | null
  department: string | null
  position: string | null
  manager: string | null
  phone: string | null
  present_address: string | null
  permanent_address: string | null
  city: string | null
  postal_code: string | null
  country: string | null
  avatar_url: string | null
}

type UserInfoCardProps = {
  profileId?: string
  currentRole?: Role | null
}

/* ---------------- COMPONENT ---------------- */

export default function UserInfoCard({
  profileId,
  currentRole,
}: UserInfoCardProps) {
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)

  const [profile, setProfile] =
    React.useState<UserProfile | null>(null)

  const [currentUserId, setCurrentUserId] =
    React.useState<string>("")

  /* ---------------- LOAD PROFILE ---------------- */

  React.useEffect(() => {
    const loadProfile = async () => {
      const me = await apiMe()
      if (!me) return

      setCurrentUserId(me.id)

      const targetId = profileId ?? me.id

      // Fetch full profile details
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

  /* ---------------- PERMISSIONS ---------------- */

  const canEdit =
    profile &&
    (
      // own profile
      profile.id === currentUserId ||

      // superadmin → everyone except other superadmins
      (currentRole === "superadmin" &&
        profile.role !== "superadmin") ||

      // admin → user + engineer
      (currentRole === "admin" &&
        (profile.role === "user" ||
          profile.role === "engineer")) ||

      // engineer → user
      (currentRole === "engineer" &&
        profile.role === "user")
    )

  /* ---------------- HANDLERS ---------------- */

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (!profile) return
    setProfile({
      ...profile,
      [e.target.name]: e.target.value,
    })
  }

  const handleSave = async () => {
    if (!profile || !canEdit) {
      toast.error("Unauthorized action")
      return
    }

    setLoading(true)

    const res = await fetch(`/api/users/${profile.id}`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({
        full_name: profile.full_name,
        employee_id: profile.employee_id,
        designation: profile.designation,
        department: profile.department,
        position: profile.position,
        manager: profile.manager,
        phone: profile.phone,
        present_address: profile.present_address,
        permanent_address: profile.permanent_address,
        city: profile.city,
        postal_code: profile.postal_code,
        country: profile.country,
      }),
    })

    setLoading(false)

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      toast.error(err.error ?? "Failed to update profile")
      return
    }

    toast.success("Profile updated successfully")
    setOpen(false)
  }

  if (!profile) return null

  /* ---------------- UI ---------------- */

  return (
    <div className="rounded-2xl border p-6">
      <div className="flex justify-between items-start gap-6">
        <div className="flex gap-4">
          <Avatar className="h-16 w-16">
            <AvatarImage src={profile.avatar_url ?? ""} />
            <AvatarFallback>
              {profile.full_name?.charAt(0)}
            </AvatarFallback>
          </Avatar>

          <div>
            <h3 className="text-lg font-semibold">
              {profile.full_name}
            </h3>
            <p className="text-sm text-muted-foreground">
              {profile.email}
            </p>
            <p className="text-sm">
              {profile.designation ?? "-"}
            </p>
          </div>
        </div>

        {canEdit && (
          <Button variant="outline" onClick={() => setOpen(true)}>
            Edit
          </Button>
        )}
      </div>

      {/* EDIT MODAL */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4">
            {[
              ["full_name", "Full Name"],
              ["employee_id", "Employee ID"],
              ["department", "Department"],
              ["designation", "Designation"],
              ["position", "Position"],
              ["manager", "Manager"],
              ["phone", "Phone Number"],
              ["city", "City"],
              ["postal_code", "Postal Code"],
              ["country", "Country"],
            ].map(([name, label]) => (
              <div key={name}>
                <Label>{label}</Label>
                <Input
                  name={name}
                  value={(profile as Record<string, string | null>)[name] ?? ""}
                  onChange={handleChange}
                />
              </div>
            ))}

            <div className="col-span-2">
              <Label>Present Address</Label>
              <Input
                name="present_address"
                value={profile.present_address ?? ""}
                onChange={handleChange}
              />
            </div>

            <div className="col-span-2">
              <Label>Permanent Address</Label>
              <Input
                name="permanent_address"
                value={profile.permanent_address ?? ""}
                onChange={handleChange}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
