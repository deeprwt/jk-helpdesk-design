/**
 * Standalone migration runner. Used by `npm run migrate`.
 *
 * Auto-discovers every .sql file in migrations/ and runs them in
 * lexicographic order against $DATABASE_URL.
 *
 * The same logic is also invoked at server startup (server.ts) so a
 * `npm run dev` will keep the DB in sync — this script is for the
 * standalone "set up the DB once" use case.
 */
import { readFileSync, readdirSync, existsSync } from "fs"
import { join } from "path"
import { Pool } from "pg"

function loadEnv() {
  const files = [".env.local", ".env"]
  for (const file of files) {
    const path = join(process.cwd(), file)
    if (!existsSync(path)) continue
    for (const line of readFileSync(path, "utf-8").split("\n")) {
      const t = line.trim()
      if (!t || t.startsWith("#")) continue
      const eq = t.indexOf("=")
      if (eq === -1) continue
      const k = t.slice(0, eq).trim()
      const v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "")
      if (k && !(k in process.env)) process.env[k] = v
    }
  }
}

async function main() {
  loadEnv()

  if (!process.env.DATABASE_URL) {
    console.error("❌ DATABASE_URL is not set")
    process.exit(1)
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL })

  const dir = join(process.cwd(), "migrations")
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()

  console.log(`⏳ Running ${files.length} migration file(s)...`)

  for (const file of files) {
    const path = join(dir, file)
    const sql = readFileSync(path, "utf-8")
    try {
      await pool.query(sql)
      console.log(`✅ ${file}`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes("already exists")) {
        console.log(`⚡ ${file} (skipped — already applied)`)
      } else {
        console.error(`❌ ${file}`)
        console.error(msg)
        await pool.end()
        process.exit(1)
      }
    }
  }

  await pool.end()
  console.log("✅ All migrations complete.")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
