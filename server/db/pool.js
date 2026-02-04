/**
 * MySQL connection pool.
 * Uses DATABASE_URL (mysql://user:pass@host/db)
 */
import { config } from 'dotenv'
import { existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

// Load .env FIRST (before any other logic)
const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..', '..')
config() // load from cwd (default)
;[
  join(root, '.env.local'),
  join(root, '.env'),
  join(process.cwd(), '.env.local'),
  join(process.cwd(), '.env'),
  join(process.cwd(), '..', '.env'),
].forEach((p) => { if (existsSync(p)) config({ path: p }) })

import mysql from 'mysql2/promise'

const connectionString = (process.env.DATABASE_URL || process.env.MYSQL_URL || '').trim()
const isMySQL = connectionString.startsWith('mysql')

// Detect placeholder HOST - user must replace with actual MySQL host (e.g. srv2069.hstgr.io or localhost)
const hasPlaceholderHost = /@HOST(\/|$)/i.test(connectionString)
if (connectionString && hasPlaceholderHost) {
  console.error('[pool] DATABASE_URL contains placeholder HOST. Replace with actual MySQL host from hPanel (e.g. srv2069.hstgr.io or localhost)')
}

let pool = null
if (connectionString && isMySQL && !hasPlaceholderHost) {
  try {
    pool = mysql.createPool({
      uri: connectionString,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    })
  } catch (err) {
    console.error('[pool] MySQL pool init failed:', err.message)
  }
}

/** Query wrapper - returns { rows, insertId } for compatibility with pg-style code */
export async function query(text, params = []) {
  if (!pool) throw new Error('Database not configured. Set DATABASE_URL (mysql://...).')
  const sql = text.replace(/\$(\d+)/g, () => '?')
  const args = params
  const [result] = await pool.execute(sql, args)
  const rows = Array.isArray(result) ? result : []
  const insertId = result?.insertId
  return { rows, insertId }
}

export function getPool() {
  return pool
}

export function isConnected() {
  return !!pool
}
