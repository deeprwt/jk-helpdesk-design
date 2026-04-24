"use client"

import * as React from "react"
import { fetchUsers, fetchOrganizations, authHeaders } from "@/lib/api"
import RoleGate from "@/components/auth/RoleGate"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Plus, X, Shield, ShieldCheck, User, CheckCircle2, Clock, BadgeCheck } from "lucide-react"
import { toast } from "sonner"

/* ── Types ────────────────────────────── */
type Org = { id: string; name: string; domain: string }

type UserRow = {
  id: string
  email: string
  full_name: string
  role: string
  avatar_url: string | null
  is_verified: boolean
  orgs: Org[]
}

const ROLE_ICON: Record<string, React.ReactNode> = {
  superadmin: <ShieldCheck className="h-3.5 w-3.5" />,
  admin: <Shield className="h-3.5 w-3.5" />,
  engineer: <User className="h-3.5 w-3.5" />,
  user: <User className="h-3.5 w-3.5" />,
}

const ROLE_BADGE: Record<string, string> = {
  superadmin: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
  admin: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  engineer: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  user: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
}

export default function AccessControlPage() {
  const [users, setUsers] = React.useState<UserRow[]>([])
  const [allOrgs, setAllOrgs] = React.useState<Org[]>([])
  const [loading, setLoading] = React.useState(true)

  // Grant dialog state
  const [grantOpen, setGrantOpen] = React.useState(false)
  const [selectedUserId, setSelectedUserId] = React.useState("")
  const [selectedOrgId, setSelectedOrgId] = React.useState("")

  // Role change dialog state
  const [roleOpen, setRoleOpen] = React.useState(false)
  const [roleTarget, setRoleTarget] = React.useState<UserRow | null>(null)
  const [newRole, setNewRole] = React.useState("")

  // Verify account dialog state
  const [verifyOpen, setVerifyOpen] = React.useState(false)
  const [verifyTarget, setVerifyTarget] = React.useState<UserRow | null>(null)
  const [verifying, setVerifying] = React.useState(false)

  /* ── Load data ──────────────────────── */
  const load = React.useCallback(async () => {
    setLoading(true)

    const [usersData, orgsData] = await Promise.all([
      fetchUsers(),
      fetchOrganizations(),
    ])

    setAllOrgs(orgsData ?? [])

    if (!usersData || usersData.length === 0) {
      setUsers([])
      setLoading(false)
      return
    }

    // Fetch org access for all users in parallel via API
    const enriched: UserRow[] = await Promise.all(
      usersData.map(async (u) => {
        const res = await fetch(`/api/users/${u.id}/org-access`, { headers: authHeaders() })
        const accessData = res.ok ? await res.json() : { orgs: [] }
        const orgs: Org[] = accessData.orgs ?? []
        return { ...u, orgs }
      })
    )

    setUsers(enriched)
    setLoading(false)
  }, [])

  React.useEffect(() => {
    load()
  }, [load])

  /* ── Grant org access ───────────────── */
  const grantAccess = async () => {
    if (!selectedUserId || !selectedOrgId) {
      toast.error("Select a user and organization")
      return
    }

    const res = await fetch("/api/org-access", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        user_id: selectedUserId,
        organization_id: selectedOrgId,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      if (res.status === 409) {
        toast.error("Access already exists")
      } else {
        toast.error(data.error ?? "Failed to grant access")
      }
      return
    }

    toast.success("Access granted")
    setGrantOpen(false)
    setSelectedUserId("")
    setSelectedOrgId("")
    load()
  }

  /* ── Revoke org access ──────────────── */
  const revokeAccess = async (userId: string, orgId: string, orgName: string) => {
    if (!confirm(`Revoke ${orgName} access?`)) return

    await fetch("/api/org-access", {
      method: "DELETE",
      headers: authHeaders(),
      body: JSON.stringify({ user_id: userId, organization_id: orgId }),
    })

    toast.success("Access revoked")
    load()
  }

  /* ── Verify user account ────────────── */
  const verifyAccount = async () => {
    if (!verifyTarget) return
    setVerifying(true)

    try {
      const res = await fetch(`/api/users/${verifyTarget.id}/verify`, {
        method: "POST",
        headers: authHeaders(),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        toast.error(data.error ?? "Failed to verify account")
        return
      }

      toast.success(`${verifyTarget.full_name || verifyTarget.email} verified — email sent`)
      setVerifyOpen(false)
      setVerifyTarget(null)
      load()
    } finally {
      setVerifying(false)
    }
  }

  /* ── Change user role ───────────────── */
  const changeRole = async () => {
    if (!roleTarget || !newRole) return

    const res = await fetch(`/api/users/${roleTarget.id}`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ role: newRole }),
    })

    if (res.ok) {
      toast.success(`${roleTarget.full_name} role changed to ${newRole}`)
    } else {
      toast.error("Failed to change role")
    }

    setRoleOpen(false)
    setRoleTarget(null)
    setNewRole("")
    load()
  }

  return (
    <RoleGate allowedRoles={["superadmin"]}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Access Control</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Manage user roles and cross-organization access
            </p>
          </div>
          <Button onClick={() => setGrantOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Grant Access
          </Button>
        </div>

        {/* Users table */}
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Organization Access</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                    No users found
                  </TableCell>
                </TableRow>
              ) : (
                users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={u.avatar_url ?? undefined} />
                          <AvatarFallback className="text-xs font-bold bg-muted">
                            {u.full_name?.[0]?.toUpperCase() ?? "?"}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium text-sm">{u.full_name || "—"}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm font-mono">
                      {u.email}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={`gap-1 ${ROLE_BADGE[u.role] ?? ROLE_BADGE.user}`}
                      >
                        {ROLE_ICON[u.role]}
                        {u.role.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {u.is_verified ? (
                        <Badge
                          variant="secondary"
                          className="gap-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Active
                        </Badge>
                      ) : (
                        <Badge
                          variant="secondary"
                          className="gap-1 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                        >
                          <Clock className="h-3.5 w-3.5" />
                          Pending
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1.5">
                        {u.orgs.length === 0 ? (
                          <span className="text-xs text-muted-foreground">
                            No org access
                          </span>
                        ) : (
                          u.orgs.map((org) => (
                            <Badge
                              key={org.id}
                              variant="outline"
                              className="gap-1 text-xs pr-1"
                            >
                              {org.name}
                              <button
                                onClick={() => revokeAccess(u.id, org.id, org.name)}
                                className="ml-0.5 hover:text-red-500 transition-colors"
                                title="Revoke access"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {!u.is_verified && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-green-700 hover:text-green-800 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20"
                            onClick={() => {
                              setVerifyTarget(u)
                              setVerifyOpen(true)
                            }}
                          >
                            <BadgeCheck className="h-4 w-4 mr-1" />
                            Verify
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setRoleTarget(u)
                            setNewRole(u.role)
                            setRoleOpen(true)
                          }}
                        >
                          Change Role
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>

        {/* Grant Access Dialog */}
        <Dialog open={grantOpen} onOpenChange={setGrantOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Grant Organization Access</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>User</Label>
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select user" />
                  </SelectTrigger>
                  <SelectContent>
                    {users
                      .filter((u) => u.role === "admin" || u.role === "engineer")
                      .map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.full_name || u.email} — {u.role}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Organization</Label>
                <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select organization" />
                  </SelectTrigger>
                  <SelectContent>
                    {allOrgs.map((org) => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name} ({org.domain})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button className="w-full" onClick={grantAccess}>
                Grant Access
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Verify Account Dialog */}
        <Dialog open={verifyOpen} onOpenChange={setVerifyOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Verify Account</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/40">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={verifyTarget?.avatar_url ?? undefined} />
                  <AvatarFallback className="text-sm font-bold bg-muted">
                    {verifyTarget?.full_name?.[0]?.toUpperCase() ?? "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="font-medium text-sm truncate">
                    {verifyTarget?.full_name || "—"}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {verifyTarget?.email}
                  </div>
                </div>
              </div>

              <p className="text-sm text-muted-foreground">
                This will activate the account so the user can sign in without clicking an
                email verification link. A confirmation email will be sent to{" "}
                <span className="font-medium text-foreground">{verifyTarget?.email}</span>.
              </p>

              <div className="flex items-center gap-2 justify-end pt-1">
                <Button
                  variant="outline"
                  onClick={() => setVerifyOpen(false)}
                  disabled={verifying}
                >
                  Cancel
                </Button>
                <Button
                  onClick={verifyAccount}
                  disabled={verifying}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <BadgeCheck className="h-4 w-4 mr-1" />
                  {verifying ? "Verifying…" : "Verify & Notify"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Change Role Dialog */}
        <Dialog open={roleOpen} onOpenChange={setRoleOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Change Role — {roleTarget?.full_name}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>New Role</Label>
                <Select value={newRole} onValueChange={setNewRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="engineer">Engineer</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="superadmin">Super Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button className="w-full" onClick={changeRole}>
                Save Role
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </RoleGate>
  )
}
