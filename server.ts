// Load .env.local FIRST before any other imports read process.env
import { readFileSync, existsSync } from "fs"
import { join } from "path"

function loadEnv() {
  const files = [".env.local", ".env"]
  for (const file of files) {
    const path = join(process.cwd(), file)
    if (!existsSync(path)) continue
    const lines = readFileSync(path, "utf-8").split("\n")
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) continue
      const eqIdx = trimmed.indexOf("=")
      if (eqIdx === -1) continue
      const key = trimmed.slice(0, eqIdx).trim()
      const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "")
      if (key && !(key in process.env)) process.env[key] = value
    }
    console.log(`📦 Loaded env from ${file}`)
  }
}
loadEnv()

import { createServer } from "http"
import { parse } from "url"
import next from "next"
import { Server as SocketIOServer } from "socket.io"
import { Pool } from "pg"
import { runSeed } from "./scripts/seed"

const dev = process.env.NODE_ENV !== "production"
const port = parseInt(process.env.PORT ?? "3000", 10)

const app = next({ dev, turbopack: dev })
const handle = app.getRequestHandler()

/* ── Auto Migration ─────────────────────────────────────────── */
async function runMigrations(pool: Pool) {
  console.log("⏳ Running database migrations...")

  const migrationFiles = [
    "migrations/001_schema.sql",
  ]

  for (const file of migrationFiles) {
    try {
      const sql = readFileSync(join(process.cwd(), file), "utf-8")
      await pool.query(sql)
      console.log(`✅ Migration applied: ${file}`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      // If tables already exist and triggers were re-created, this is fine
      if (msg.includes("already exists")) {
        console.log(`⚡ Migration skipped (already applied): ${file}`)
      } else {
        console.error(`❌ Migration failed: ${file}`, msg)
        throw err
      }
    }
  }

  console.log("✅ All migrations complete.")
}

async function main() {
  /* ── Database pool ──────────────────────────────────────────── */
  const pgPool = new Pool({ connectionString: process.env.DATABASE_URL })

  // Test DB connection
  try {
    const client = await pgPool.connect()
    client.release()
    console.log("✅ Connected to PostgreSQL")
  } catch (err) {
    console.error("❌ Could not connect to PostgreSQL:", err)
    process.exit(1)
  }

  // Run migrations then seed
  await runMigrations(pgPool)
  await runSeed(pgPool)

  /* ── Next.js ────────────────────────────────────────────────── */
  await app.prepare()

  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url ?? "/", true)
    handle(req, res, parsedUrl)
  })

  /* ── Socket.IO ──────────────────────────────────────────────── */
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL ?? `http://localhost:${port}`,
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["websocket", "polling"],
  })

  // Expose io globally so API routes can emit events
  ;(global as Record<string, unknown>)["_io"] = io

  io.on("connection", (socket) => {
    socket.on("join:user", (userId: string) => {
      if (userId) socket.join(`user:${userId}`)
    })

    socket.on("join:ticket", (ticketId: string) => {
      if (ticketId) socket.join(`ticket:${ticketId}`)
    })

    socket.on("leave:ticket", (ticketId: string) => {
      socket.leave(`ticket:${ticketId}`)
    })

    socket.on("disconnect", () => {/* handled by socket.io */})
  })

  /* ── PostgreSQL LISTEN / NOTIFY ─────────────────────────────── */
  const listenClient = await pgPool.connect()

  const channels = [
    "ticket_changes",
    "message_changes",
    "activity_changes",
    "notification_changes",
    "user_changes",
  ]

  for (const ch of channels) {
    await listenClient.query(`LISTEN ${ch}`)
  }

  listenClient.on("notification", (msg) => {
    if (!msg.payload) return

    let payload: Record<string, unknown>
    try {
      payload = JSON.parse(msg.payload)
    } catch {
      return
    }

    switch (msg.channel) {
      case "ticket_changes":
        io.to(`ticket:${payload.id}`).emit("ticket:updated", payload)
        if (payload.org_domain) {
          io.to(`org:${payload.org_domain}`).emit("tickets:refresh", payload)
        }
        io.emit("tickets:refresh", payload)
        break

      case "message_changes":
        io.to(`ticket:${payload.ticket_id}`).emit("ticket:message", payload)
        break

      case "activity_changes":
        io.to(`ticket:${payload.ticket_id}`).emit("ticket:activity", payload)
        break

      case "notification_changes":
        io.to(`user:${payload.user_id}`).emit("notification:new", payload)
        break

      case "user_changes":
        if (payload.operation === "DELETE") {
          io.to(`user:${payload.id}`).emit("user:deleted", { userId: payload.id })
        }
        break
    }
  })

  listenClient.on("error", (err) => {
    console.error("PG listen client error:", err)
  })

  /* ── Start ──────────────────────────────────────────────────── */
  httpServer.listen(port, () => {
    console.log(`\n🚀 Ready on http://localhost:${port} [${dev ? "dev" : "prod"}]\n`)
  })
}

main().catch((err) => {
  console.error("Server failed to start:", err)
  process.exit(1)
})
