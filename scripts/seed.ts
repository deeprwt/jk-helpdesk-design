import bcrypt from "bcryptjs"
import { Pool } from "pg"

const SUPERADMIN_EMAIL    = "chaman.raghav@jkmail.com"
const SUPERADMIN_PASSWORD = "Chaman@123"
const SUPERADMIN_NAME     = "Chaman Raghav"
const ORG_DOMAIN          = "jkmail.com"
const ORG_NAME            = "JK Mail"

export async function runSeed(pool: Pool) {
  console.log("🌱 Running seed...")

  /* 1. Ensure organization exists */
  await pool.query(
    `INSERT INTO organizations (name, domain, status)
     VALUES ($1, $2, 'active')
     ON CONFLICT (domain) DO NOTHING`,
    [ORG_NAME, ORG_DOMAIN]
  )

  /* 2. Check if superadmin already exists */
  const existing = await pool.query(
    "SELECT id, role FROM users WHERE email = $1",
    [SUPERADMIN_EMAIL]
  )

  if (existing.rows.length > 0) {
    const user = existing.rows[0]
    if (user.role !== "superadmin") {
      await pool.query("UPDATE users SET role = 'superadmin' WHERE id = $1", [user.id])
      console.log(`✅ Promoted ${SUPERADMIN_EMAIL} to superadmin.`)
    } else {
      console.log(`⚡ Superadmin ${SUPERADMIN_EMAIL} already exists — skipping.`)
    }
    return
  }

  /* 3. Hash password and insert */
  const passwordHash = await bcrypt.hash(SUPERADMIN_PASSWORD, 10)

  await pool.query(
    `INSERT INTO users
       (email, password_hash, first_name, last_name, full_name,
        role, org_domain, is_verified)
     VALUES ($1, $2, $3, $4, $5, 'superadmin', $6, true)`,
    [
      SUPERADMIN_EMAIL,
      passwordHash,
      "Chaman",
      "Raghav",
      SUPERADMIN_NAME,
      ORG_DOMAIN,
    ]
  )

  console.log(`✅ Superadmin created: ${SUPERADMIN_EMAIL}`)
}
