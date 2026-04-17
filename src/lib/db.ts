import { Pool } from "pg"

declare global {
  // eslint-disable-next-line no-var
  var _pgPool: Pool | undefined
}

function createPool() {
  return new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  })
}

// Reuse pool across hot-reloads in dev
export const pool = globalThis._pgPool ?? createPool()
if (process.env.NODE_ENV !== "production") globalThis._pgPool = pool

export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const res = await pool.query(text, params)
  return res.rows as T[]
}

export async function queryOne<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T | null> {
  const res = await pool.query(text, params)
  return (res.rows[0] as T) ?? null
}
