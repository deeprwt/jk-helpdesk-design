"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { apiMe } from "@/lib/api"

type Role = "user" | "engineer" | "admin" | "superadmin"

export default function RoleGate({
  allowedRoles,
  children,
}: {
  allowedRoles: Role[]
  children: React.ReactNode
}) {
  const router = useRouter()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let mounted = true

    const checkRole = async () => {
      const user = await apiMe()
      if (!mounted) return

      if (!user) {
        router.replace("/signin")
        return
      }

      if (!allowedRoles.includes(user.role as Role)) {
        router.replace("/")
        return
      }

      setChecking(false)
    }

    checkRole()
    return () => { mounted = false }
  }, [allowedRoles, router])

  if (checking) return null
  return <>{children}</>
}
