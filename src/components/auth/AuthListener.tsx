"use client"

import { useEffect } from "react"
import { getToken } from "@/lib/api"
import { connectSocket } from "@/lib/socket"

export default function AuthListener() {
  useEffect(() => {
    const token = getToken()
    if (token) {
      connectSocket()
    }
  }, [])

  return null
}
