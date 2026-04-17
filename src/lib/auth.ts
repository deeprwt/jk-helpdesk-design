import jwt from "jsonwebtoken"
import { NextRequest } from "next/server"
import { queryOne } from "./db"

const JWT_SECRET = process.env.JWT_SECRET ?? "change-me-in-production"
const JWT_EXPIRES = "7d"

export type JWTPayload = {
  userId: string
  email: string
  role: string
  orgDomain: string
}

export function signToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES })
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload
  } catch {
    return null
  }
}

export function extractToken(req: Request | NextRequest): string | null {
  const auth =
    req.headers.get("authorization") ?? req.headers.get("Authorization")
  if (auth?.startsWith("Bearer ")) return auth.slice(7)
  return null
}

export type AuthUser = {
  id: string
  email: string
  full_name: string
  role: string
  org_domain: string
  avatar_url: string | null
  is_verified: boolean
}

export async function requireAuth(req: Request | NextRequest): Promise<AuthUser | null> {
  const token = extractToken(req)
  if (!token) return null

  const payload = verifyToken(token)
  if (!payload) return null

  const user = await queryOne<AuthUser>(
    "SELECT id, email, full_name, role, org_domain, avatar_url, is_verified FROM users WHERE id = $1",
    [payload.userId]
  )

  return user
}
