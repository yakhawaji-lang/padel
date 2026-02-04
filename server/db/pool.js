/**
 * MySQL connection pool for Hostinger.
 * Uses DATABASE_URL (mysql://user:pass@host/db)
 */
import { config } from 'dotenv'
import { existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..', '..')
const cwd = process.cwd()

// Load from multiple paths (Hostinger cwd may differ from __dirname)
;[
  join(root, '.env.local'),
  join(root, '.env'),
  join(cwd, '.env.local'),
  join(cwd, '.env'),
  join(cwd, '..', '.env'),
].forEach((p) => { if (existsSync(p)) config({ path: p }) })

import mysql from 'mysql2/promise'

const connectionString = (process.env.DATABASE_URL || process.env.MYSQL_URL || '').trim()
const isMySQL = connectionString.startsWith('mysql')

let pool = null
if (connectionString && isMySQL) {
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
