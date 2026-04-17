import { getToken } from "./api"

export type NotificationType = "message" | "acquired" | "closed" | "hold" | "status_changed"

export async function sendNotification(params: {
  user_id: string
  actor_id: string
  ticket_id: string
  type: NotificationType
  message: string
}): Promise<void> {
  if (!params.user_id || params.user_id === params.actor_id) return

  try {
    const token = getToken()
    if (!token) return

    await fetch("/api/notifications/create", {
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

export async function sendEmailNotification(params: {
  recipient_email: string
  recipient_name: string
  actor_name: string
  ticket_id: string
  ticket_subject: string
  action: string
  comment?: string | null
}): Promise<void> {
  try {
    const token = getToken()
    if (!token) return

    await fetch("/api/email/send", {
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
