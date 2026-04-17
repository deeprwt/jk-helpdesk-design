"use client"

import * as React from "react"
import Link from "next/link"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { apiMe, apiLogout, type User } from "@/lib/api"

export default function UserDropdown() {
  const [profile, setProfile] = React.useState<User | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    apiMe().then((user) => {
      setProfile(user)
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center gap-3">
        <Skeleton className="h-11 w-11 rounded-full" />
        <Skeleton className="h-4 w-24" />
      </div>
    )
  }

  if (!profile) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center text-gray-700 dark:text-gray-400">
          <Avatar className="mr-3 h-11 w-11">
            <AvatarImage src={profile.avatar_url ?? ""} />
            <AvatarFallback>{profile.full_name?.charAt(0) ?? "U"}</AvatarFallback>
          </Avatar>
          <span className="mr-1 font-medium text-theme-sm">{profile.full_name}</span>
          <svg className="stroke-gray-500 dark:stroke-gray-400" width="18" height="20" viewBox="0 0 18 20" fill="none">
            <path d="M4.3125 8.65625L9 13.3437L13.6875 8.65625" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="mt-4 w-[260px] rounded-2xl border border-gray-200 bg-white p-3 shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark">
        <div className="px-2 pb-3">
          <span className="block font-medium text-theme-sm text-gray-700 dark:text-gray-400">{profile.full_name}</span>
          <span className="mt-0.5 block text-theme-xs text-gray-500 dark:text-gray-400">{profile.email}</span>
        </div>

        <DropdownMenuSeparator className="mb-2" />

        <DropdownMenuItem asChild>
          <Link href="/profile" className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-theme-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5">
            Edit profile
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator className="my-2" />

        <DropdownMenuItem
          onClick={async () => {
            await apiLogout()
            toast.success("Signed out successfully")
            window.location.href = "/signin"
          }}
          className="cursor-pointer px-3 py-2 text-theme-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5"
        >
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
