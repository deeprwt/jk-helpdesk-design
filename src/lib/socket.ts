"use client"

import { io, type Socket } from "socket.io-client"

let socket: Socket | null = null

export function getSocket(): Socket {
  if (!socket) {
    const url =
      typeof window !== "undefined"
        ? window.location.origin
        : (process.env.NEXT_PUBLIC_APP_URL as string)
    socket = io(url, {
      autoConnect: false,
      transports: ["websocket", "polling"],
    })
  }
  return socket
}

export function connectSocket(userId?: string): Socket {
  const s = getSocket()

  if (!s.connected) {
    s.connect()
  }

  if (userId) {
    s.emit("join:user", userId)
  }

  return s
}

export function disconnectSocket(): void {
  if (socket?.connected) {
    socket.disconnect()
  }
}

export function joinTicket(ticketId: string): void {
  getSocket().emit("join:ticket", ticketId)
}

export function leaveTicket(ticketId: string): void {
  getSocket().emit("leave:ticket", ticketId)
}
