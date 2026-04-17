// Client-side API helper

/* ── Token management ─────────────────────────────────────── */
export function getToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem("auth_token")
}

export function setToken(token: string): void {
  localStorage.setItem("auth_token", token)
}

export function clearToken(): void {
  localStorage.removeItem("auth_token")
  localStorage.removeItem("auth_user")
}

export function authHeaders(): Record<string, string> {
  const token = getToken()
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

/* ── Auth ──────────────────────────────────────────────────── */
export type User = {
  id: string
  email: string
  full_name: string
  role: "user" | "engineer" | "admin" | "superadmin"
  org_domain: string
  avatar_url: string | null
  is_verified: boolean
  first_name?: string
  last_name?: string
  phone?: string
  city?: string
  country?: string
}

export async function apiLogin(email: string, password: string) {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? "Login failed")
  if (data.token) setToken(data.token)
  return data as { token: string; user: User }
}

export async function apiLogout() {
  clearToken()
  await fetch("/api/auth/logout", { method: "POST", headers: authHeaders() }).catch(() => {})
}

export async function apiMe(): Promise<User | null> {
  const token = getToken()
  if (!token) return null
  const res = await fetch("/api/auth/me", { headers: authHeaders() })
  if (!res.ok) {
    clearToken()
    return null
  }
  const data = await res.json()
  return data.user as User
}

/* ── Notifications ─────────────────────────────────────────── */
export type Notification = {
  id: string
  ticket_id: string
  message: string
  type: string
  is_read: boolean
  created_at: string
  actor_id: string
  actor: { full_name: string; avatar_url: string | null } | null
}

export async function fetchNotifications(): Promise<Notification[]> {
  const res = await fetch("/api/notifications", { headers: authHeaders() })
  if (!res.ok) return []
  const data = await res.json()
  return data.notifications ?? []
}

export async function markNotificationsRead(): Promise<void> {
  await fetch("/api/notifications/read", { method: "PATCH", headers: authHeaders() })
}

/* ── Users ──────────────────────────────────────────────────── */
export async function fetchUsers(params?: { org_domain?: string; role?: string }) {
  const qs = new URLSearchParams(params as Record<string, string> ?? {}).toString()
  const res = await fetch(`/api/users${qs ? `?${qs}` : ""}`, { headers: authHeaders() })
  if (!res.ok) return []
  const data = await res.json()
  return data.users as User[]
}

export async function fetchUser(id: string): Promise<User | null> {
  const res = await fetch(`/api/users/${id}`, { headers: authHeaders() })
  if (!res.ok) return null
  const data = await res.json()
  return data.user as User
}

/* ── Tickets ────────────────────────────────────────────────── */
export type Ticket = {
  id: string
  requester_id: string
  requester_name: string
  contact: string | null
  subject: string
  description: string | null
  status: string
  priority: string | null
  category: string | null
  sub_category: string | null
  location: string | null
  link: string | null
  assignee: string | null
  assigned_at: string | null
  closed_comment: string | null
  hold_comment: string | null
  hold_duration_hours: number | null
  hold_started_at: string | null
  hold_until: string | null
  created_at: string
  updated_at: string
  sla_response_at: string | null
  sla_resolution_at: string | null
  sla_response_breached: boolean
  sla_resolution_breached: boolean
  sla_admin_notified: boolean
  org_domain: string | null
  // joined fields
  requester_full_name?: string | null
  requester_email?: string | null
  requester_avatar?: string | null
  assignee_full_name?: string | null
  assignee_email?: string | null
  assignee_avatar?: string | null
  [key: string]: unknown
}

export async function fetchTickets(params?: Record<string, string>) {
  const qs = new URLSearchParams(params ?? {}).toString()
  const res = await fetch(`/api/tickets${qs ? `?${qs}` : ""}`, { headers: authHeaders() })
  if (!res.ok) return []
  const data = await res.json()
  return data.tickets as Ticket[]
}

export async function fetchTicket(id: string) {
  const res = await fetch(`/api/tickets/${id}`, { headers: authHeaders() })
  if (!res.ok) return null
  const data = await res.json()
  return data.ticket as Ticket
}

export async function fetchTicketMessages(ticketId: string) {
  const res = await fetch(`/api/tickets/${ticketId}/messages`, { headers: authHeaders() })
  if (!res.ok) return []
  const data = await res.json()
  return data.messages as {
    id: string; ticket_id: string; sender_id: string
    sender_name: string; message: string; created_at: string
  }[]
}

export async function fetchTicketActivity(ticketId: string) {
  const res = await fetch(`/api/tickets/${ticketId}/activity`, { headers: authHeaders() })
  if (!res.ok) return []
  const data = await res.json()
  return data.activity
}

export async function fetchTicketAttachments(ticketId: string) {
  const res = await fetch(`/api/tickets/${ticketId}/attachments`, { headers: authHeaders() })
  if (!res.ok) return []
  const data = await res.json()
  return data.attachments
}

/* ── Assets ─────────────────────────────────────────────────── */
export async function fetchAssets(params?: Record<string, string>) {
  const qs = new URLSearchParams(params ?? {}).toString()
  const res = await fetch(`/api/assets${qs ? `?${qs}` : ""}`, { headers: authHeaders() })
  if (!res.ok) return []
  const data = await res.json()
  return data.assets
}

export async function fetchAsset(id: string) {
  const res = await fetch(`/api/assets/${id}`, { headers: authHeaders() })
  if (!res.ok) return null
  const data = await res.json()
  return data.asset
}

/* ── Organizations ──────────────────────────────────────────── */
export async function fetchOrganizations() {
  const res = await fetch("/api/organizations", { headers: authHeaders() })
  if (!res.ok) return []
  const data = await res.json()
  return data.organizations
}

/* ── IO helper (emit via server) ─────────────────────────────── */
export function emitSocketEvent(event: string, payload: unknown) {
  fetch("/api/socket/emit", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ event, payload }),
  }).catch(() => {})
}
