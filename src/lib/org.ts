import { authHeaders } from "./api"

export function extractOrgDomain(email: string): string {
  return email.split("@")[1]?.toLowerCase() ?? ""
}

export async function getOrgUserIds(domain: string): Promise<string[]> {
  if (!domain) return []

  try {
    const res = await fetch(`/api/users?org_domain=${encodeURIComponent(domain)}`, {
      headers: authHeaders(),
    })
    if (!res.ok) return []
    const data = await res.json()
    return (data.users ?? []).map((u: { id: string }) => u.id)
  } catch {
    return []
  }
}

export async function getUserAccessibleDomains(
  userId: string,
  userEmail: string,
  userRole: string
): Promise<string[]> {
  if (userRole === "superadmin") {
    try {
      const res = await fetch("/api/organizations", { headers: authHeaders() })
      if (res.ok) {
        const data = await res.json()
        const domains = (data.organizations ?? [])
          .filter((o: { status: string }) => o.status === "active")
          .map((o: { domain: string }) => o.domain)
        if (domains.length > 0) return domains
      }
    } catch {
      // fallback
    }
  }

  return [extractOrgDomain(userEmail)]
}
