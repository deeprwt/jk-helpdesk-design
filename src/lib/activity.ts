import { getToken } from "./api"

export type ActivityAction =
  | "created"
  | "acquired"
  | "closed"
  | "hold"
  | "reopened"
  | "reassigned"
  | "sla_response_breach"
  | "sla_resolution_breach"

export async function logActivity(params: {
  ticket_id: string
  actor_id: string
  action: ActivityAction
  details?: Record<string, unknown>
}): Promise<void> {
  try {
    const token = getToken()
    if (!token) return

    await fetch("/api/activity/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(params),
    })
  } catch {
    // Non-blocking
  }
}
