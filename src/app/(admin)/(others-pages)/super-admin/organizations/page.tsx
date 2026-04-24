"use client"

import * as React from "react"
import { fetchOrganizations, authHeaders } from "@/lib/api"
import RoleGate from "@/components/auth/RoleGate"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
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
import { Plus, Trash2, Power, Building2, Globe, Users, Eraser, AlertTriangle } from "lucide-react"
import { toast } from "sonner"

type Org = {
  id: string
  name: string
  domain: string
  status: string
  created_at: string
  user_count?: number
}

export default function OrganizationsPage() {
  const [orgs, setOrgs] = React.useState<Org[]>([])
  const [loading, setLoading] = React.useState(true)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [newName, setNewName] = React.useState("")
  const [newDomain, setNewDomain] = React.useState("")
  const [saving, setSaving] = React.useState(false)

  // Clean Tickets dialog state
  const [cleanOpen, setCleanOpen] = React.useState(false)
  const [cleanTarget, setCleanTarget] = React.useState<Org | null>(null)
  const [cleanCount, setCleanCount] = React.useState<number | null>(null)
  const [cleanConfirm, setCleanConfirm] = React.useState("")
  const [cleanLoading, setCleanLoading] = React.useState(false)
  const [cleaning, setCleaning] = React.useState(false)

  const load = React.useCallback(async () => {
    setLoading(true)

    const orgData = await fetchOrganizations()

    if (!orgData || orgData.length === 0) {
      setOrgs([])
      setLoading(false)
      return
    }

    // Get user counts per org via API
    const orgsWithCounts = await Promise.all(
      orgData.map(async (org: Org) => {
        const res = await fetch(`/api/organizations/${org.id}/user-count`, { headers: authHeaders() })
        const data = res.ok ? await res.json() : { count: 0 }
        return { ...org, user_count: data.count ?? 0 }
      })
    )

    setOrgs(orgsWithCounts)
    setLoading(false)
  }, [])

  React.useEffect(() => {
    load()
  }, [load])

  const addOrg = async () => {
    if (!newName.trim() || !newDomain.trim()) {
      toast.error("Name and domain are required")
      return
    }

    setSaving(true)

    const res = await fetch("/api/organizations", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        name: newName.trim(),
        domain: newDomain.trim().toLowerCase(),
        status: "active",
      }),
    })

    setSaving(false)

    const data = await res.json()

    if (!res.ok) {
      if (res.status === 409) {
        toast.error("This domain already exists")
      } else {
        toast.error(data.error ?? "Failed to add organization")
      }
      return
    }

    toast.success("Organization added")
    setNewName("")
    setNewDomain("")
    setDialogOpen(false)
    load()
  }

  const toggleStatus = async (org: Org) => {
    const next = org.status === "active" ? "inactive" : "active"

    await fetch(`/api/organizations/${org.id}`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ status: next }),
    })

    toast.success(
      next === "active"
        ? `${org.name} activated`
        : `${org.name} deactivated`
    )
    load()
  }

  const openCleanDialog = async (org: Org) => {
    setCleanTarget(org)
    setCleanOpen(true)
    setCleanConfirm("")
    setCleanCount(null)
    setCleanLoading(true)

    try {
      const res = await fetch(`/api/organizations/${org.id}/clean-tickets`, {
        headers: authHeaders(),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setCleanCount(data.ticket_count ?? 0)
      } else {
        toast.error(data.error ?? "Failed to load ticket count")
        setCleanCount(0)
      }
    } finally {
      setCleanLoading(false)
    }
  }

  const cleanTickets = async () => {
    if (!cleanTarget) return
    if (cleanConfirm.trim().toLowerCase() !== cleanTarget.domain.toLowerCase()) {
      toast.error("Type the domain exactly to confirm")
      return
    }

    setCleaning(true)
    try {
      const res = await fetch(`/api/organizations/${cleanTarget.id}/clean-tickets`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ confirm_domain: cleanTarget.domain }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        toast.error(data.error ?? "Failed to clean tickets")
        return
      }

      toast.success(
        data.deleted_count > 0
          ? `Deleted ${data.deleted_count} ticket${data.deleted_count === 1 ? "" : "s"} for ${cleanTarget.name}`
          : `No tickets to delete for ${cleanTarget.name}`
      )
      setCleanOpen(false)
      setCleanTarget(null)
      setCleanConfirm("")
      setCleanCount(null)
      load()
    } finally {
      setCleaning(false)
    }
  }

  const deleteOrg = async (org: Org) => {
    if (
      !confirm(
        `Delete "${org.name}" (${org.domain})? This will remove all access mappings for this organization.`
      )
    ) {
      return
    }

    await fetch(`/api/organizations/${org.id}`, {
      method: "DELETE",
      headers: authHeaders(),
    })

    toast.success("Organization deleted")
    load()
  }

  return (
    <RoleGate allowedRoles={["superadmin"]}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Organization Management</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Manage whitelisted domains and organizations
            </p>
          </div>

          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Organization
          </Button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-300" />
            </div>
            <div>
              <p className="text-2xl font-bold">{orgs.length}</p>
              <p className="text-xs text-muted-foreground">Total Orgs</p>
            </div>
          </Card>

          <Card className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <Globe className="h-5 w-5 text-green-600 dark:text-green-300" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {orgs.filter((o) => o.status === "active").length}
              </p>
              <p className="text-xs text-muted-foreground">Active</p>
            </div>
          </Card>

          <Card className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
              <Users className="h-5 w-5 text-violet-600 dark:text-violet-300" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {orgs.reduce((s, o) => s + (o.user_count ?? 0), 0)}
              </p>
              <p className="text-xs text-muted-foreground">Total Users</p>
            </div>
          </Card>
        </div>

        {/* Table */}
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organization</TableHead>
                <TableHead>Domain</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Users</TableHead>
                <TableHead>Created</TableHead>
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
              ) : orgs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                    No organizations yet. Add one to get started.
                  </TableCell>
                </TableRow>
              ) : (
                orgs.map((org) => (
                  <TableRow key={org.id}>
                    <TableCell className="font-semibold">{org.name}</TableCell>
                    <TableCell className="text-muted-foreground font-mono text-sm">
                      {org.domain}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={org.status === "active" ? "default" : "secondary"}
                        className={
                          org.status === "active"
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                            : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                        }
                      >
                        {org.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{org.user_count ?? 0}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(org.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          title={
                            org.status === "active" ? "Deactivate" : "Activate"
                          }
                          onClick={() => toggleStatus(org)}
                        >
                          <Power
                            className={`h-4 w-4 ${
                              org.status === "active"
                                ? "text-green-500"
                                : "text-muted-foreground"
                            }`}
                          />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Clean all tickets for this organization"
                          onClick={() => openCleanDialog(org)}
                        >
                          <Eraser className="h-4 w-4 text-amber-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Delete organization"
                          onClick={() => deleteOrg(org)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>

        {/* Clean Tickets Dialog */}
        <Dialog open={cleanOpen} onOpenChange={setCleanOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                Clean All Tickets
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-900/40 p-3">
                <p className="text-sm text-amber-900 dark:text-amber-200">
                  This will permanently delete <strong>all tickets</strong> belonging to{" "}
                  <strong>{cleanTarget?.name}</strong> ({cleanTarget?.domain}), including
                  every message, attachment, activity log, and notification attached to
                  them. Users and assets are not affected.
                </p>
              </div>

              <div className="rounded-lg border p-3 bg-muted/40">
                <p className="text-xs text-muted-foreground mb-1">Tickets to be deleted</p>
                <p className="text-2xl font-bold">
                  {cleanLoading ? "…" : cleanCount ?? 0}
                </p>
              </div>

              <div className="space-y-2">
                <Label>
                  Type{" "}
                  <span className="font-mono font-semibold text-foreground">
                    {cleanTarget?.domain}
                  </span>{" "}
                  to confirm
                </Label>
                <Input
                  value={cleanConfirm}
                  onChange={(e) => setCleanConfirm(e.target.value)}
                  placeholder={cleanTarget?.domain}
                  autoComplete="off"
                  disabled={cleaning}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <Button
                  variant="outline"
                  onClick={() => setCleanOpen(false)}
                  disabled={cleaning}
                >
                  Cancel
                </Button>
                <Button
                  onClick={cleanTickets}
                  disabled={
                    cleaning ||
                    cleanLoading ||
                    cleanConfirm.trim().toLowerCase() !==
                      (cleanTarget?.domain.toLowerCase() ?? "___")
                  }
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  <Eraser className="h-4 w-4 mr-1" />
                  {cleaning ? "Cleaning…" : "Clean Tickets"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Add Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Organization</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Organization Name</Label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. JK Foods"
                />
              </div>

              <div className="space-y-2">
                <Label>Domain</Label>
                <Input
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                  placeholder="e.g. jkmail.com"
                />
                <p className="text-xs text-muted-foreground">
                  Only users with emails from this domain can register
                </p>
              </div>

              <Button className="w-full" onClick={addOrg} disabled={saving}>
                {saving ? "Adding…" : "Add Organization"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </RoleGate>
  )
}
