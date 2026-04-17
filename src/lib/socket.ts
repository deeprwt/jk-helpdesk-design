"use client"

import { io, type Socket } from "socket.io-client"

let socket: Socket | null = null

export function getSocket(): Socket {
  if (!socket) {
    socket = io(typeof window !== "undefined" ? window.location.origin : "http://localhost:3000", {
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
