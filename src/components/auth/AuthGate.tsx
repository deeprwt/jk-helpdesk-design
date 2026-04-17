"use client"

import { useEffect, useState, useCallback } from "react"
import { usePathname, useRouter } from "next/navigation"
import { getToken, clearToken, apiMe } from "@/lib/api"
import { connectSocket, disconnectSocket } from "@/lib/socket"

const PUBLIC_ROUTES = ["/signin", "/signup", "/reset-password", "/update-password", "/verify-email"]

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  const isPublicRoute = PUBLIC_ROUTES.includes(pathname)
  const [checking, setChecking] = useState(!isPublicRoute)
  const [removed, setRemoved] = useState(false)

  const forceLogout = useCallback(() => {
    setRemoved(true)
    clearToken()
    disconnectSocket()
    setTimeout(() => { window.location.href = "/signin" }, 3000)
  }, [])

  useEffect(() => {
    if (isPublicRoute) return

    let mounted = true
    let interval: ReturnType<typeof setInterval> | null = null
    let cleanupSocket: (() => void) | null = null

    const init = async () => {
      const token = getToken()
      if (!token) {
        router.replace("/signin")
        return
      }

      const user = await apiMe()
      if (!mounted) return

      if (!user) {
        clearToken()
        router.replace("/signin")
        return
      }

      setChecking(false)

      const socket = connectSocket(user.id)

      const handleDeleted = ({ userId }: { userId: string }) => {
        if (userId === user.id) forceLogout()
      }
      socket.on("user:deleted", handleDeleted)

      cleanupSocket = () => socket.off("user:deleted", handleDeleted)

      interval = setInterval(async () => {
        if (!mounted) return
        const stillValid = await apiMe()
        if (!mounted) return
        if (!stillValid) forceLogout()
      }, 60000)
    }

    init()

    return () => {
      mounted = false
      if (interval) clearInterval(interval)
      if (cleanupSocket) cleanupSocket()
    }
  }, [isPublicRoute, router, forceLogout])

  if (removed) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white dark:bg-gray-900">
        <div className="mx-4 max-w-md rounded-2xl border border-red-200 bg-red-50 p-8 text-center shadow-xl dark:border-red-800 dark:bg-red-950/30">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/40">
            <svg className="h-7 w-7 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
          </div>
          <h2 className="mb-2 text-xl font-bold text-red-800 dark:text-red-300">Account Removed</h2>
          <p className="text-sm text-red-700 dark:text-red-400">Your account has been removed. Please contact your team.</p>
          <p className="mt-3 text-xs text-red-500">Redirecting to login...</p>
        </div>
      </div>
    )
  }

  if (!isPublicRoute && checking) {
    return (
      <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-white dark:bg-gray-900">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  return <>{children}</>
}
