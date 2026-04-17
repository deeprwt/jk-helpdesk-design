"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Bell, MessageSquare, UserCheck, XCircle, PauseCircle, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"
import { fetchNotifications, markNotificationsRead, apiMe, type Notification } from "@/lib/api"
import { connectSocket, getSocket } from "@/lib/socket"

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

const TYPE_ICON: Record<string, React.ReactNode> = {
  message: <MessageSquare className="h-3.5 w-3.5" />,
  acquired: <UserCheck className="h-3.5 w-3.5" />,
  closed: <XCircle className="h-3.5 w-3.5" />,
  hold: <PauseCircle className="h-3.5 w-3.5" />,
  status_changed: <RefreshCw className="h-3.5 w-3.5" />,
}

const TYPE_COLOR: Record<string, string> = {
  message: "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300",
  acquired: "bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-300",
  closed: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
  hold: "bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-300",
  status_changed: "bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300",
}

export default function NotificationDropdown() {
  const router = useRouter()
  const [notifications, setNotifications] = React.useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = React.useState(0)
  const [open, setOpen] = React.useState(false)

  const load = React.useCallback(async () => {
    const data = await fetchNotifications()
    setNotifications(data)
    setUnreadCount(data.filter((n) => !n.is_read).length)
  }, [])

  React.useEffect(() => {
    load()

    apiMe().then((user) => {
      if (!user) return
      const socket = connectSocket(user.id)

      socket.on("notification:new", () => {
        load()
      })

      return () => {
        socket.off("notification:new")
      }
    })
  }, [load])

  const handleOpenChange = async (isOpen: boolean) => {
    setOpen(isOpen)
    if (isOpen && unreadCount > 0) {
      await markNotificationsRead()
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
      setUnreadCount(0)
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white leading-none">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[380px] p-0 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold">Notifications</h4>
            {unreadCount > 0 && (
              <span className="rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 text-[10px] font-bold px-1.5 py-0.5">
                {unreadCount} new
              </span>
            )}
          </div>
          <Button variant="ghost" size="sm" className="text-xs h-7 text-muted-foreground" onClick={() => { setOpen(false); router.push("/notifications") }}>
            View all
          </Button>
        </div>

        <div className="max-h-[440px] overflow-y-auto divide-y divide-border/40">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <Bell className="h-8 w-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No notifications yet</p>
            </div>
          ) : (
            notifications.map((n) => {
              const actorName = n.actor?.full_name ?? "Someone"
              const actorInitial = actorName[0]?.toUpperCase() ?? "?"
              const iconEl = TYPE_ICON[n.type] ?? TYPE_ICON.status_changed
              const iconColor = TYPE_COLOR[n.type] ?? TYPE_COLOR.status_changed

              return (
                <Link key={n.id} href={`/ticket/${n.ticket_id}`} onClick={() => setOpen(false)}
                  className={cn("flex items-start gap-3 px-4 py-3 hover:bg-muted/60 transition-colors", !n.is_read && "bg-blue-50/60 dark:bg-blue-950/20")}>
                  <div className="relative flex-shrink-0 mt-0.5">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={n.actor?.avatar_url ?? undefined} />
                      <AvatarFallback className="text-xs font-bold bg-muted">{actorInitial}</AvatarFallback>
                    </Avatar>
                    <span className={cn("absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-background", iconColor)}>
                      {iconEl}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-snug">
                      <span className="font-semibold">{actorName}</span>{" "}
                      <span className="text-foreground/80">{n.message}</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">{timeAgo(n.created_at)}</p>
                  </div>
                  {!n.is_read && <span className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-blue-500" />}
                </Link>
              )
            })
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
