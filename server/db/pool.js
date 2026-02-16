/**
 * MySQL connection pool.
 * Uses DATABASE_URL (mysql://user:pass@host/db) or database.config.json.
 * The database name in the URL (e.g. padel_db) is the one used for all queries — all data is read from and written to that database.
 */
import { config } from 'dotenv'
import { existsSync, readFileSync } from 'fs'
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
  join(process.cwd(), '..', '..', '.env'),
].forEach((p) => { if (existsSync(p)) config({ path: p }) })

// Fallback: قراءة من ملف (عند فشل Environment Variables على Hostinger)
// Hostinger: أنشئ database.config.json في domains/playtix.app/ (خارج public_html)
function loadFromConfigFile() {
  const cwd = process.cwd()
  const paths = [
    join(root, 'database.config.json'),
    join(cwd, 'database.config.json'),
    join(cwd, '..', 'database.config.json'),
    join(cwd, '..', '..', 'database.config.json'),
    join(cwd, '..', '..', '..', 'database.config.json'),
    join(cwd, '..', '..', '..', '..', 'database.config.json'),
    join(root, '..', 'database.config.json'),
    join(root, '..', '..', 'database.config.json'),
    join(root, '..', '..', '..', 'database.config.json'),
    join(root, '..', '..', '..', '..', 'database.config.json')
  ]
  for (const p of paths) {
    if (existsSync(p)) {
      try {
        const data = JSON.parse(readFileSync(p, 'utf8'))
        return (data.url || data.DATABASE_URL || data.connectionString || '').trim()
      } catch (e) {
        console.warn('[pool] Could not parse', p, e.message)
      }
    }
  }
  return ''
}

import mysql from 'mysql2/promise'

let connectionString = (process.env.DATABASE_URL || process.env.MYSQL_URL || '').trim()
if (!connectionString) connectionString = loadFromConfigFile()
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
      queueLimit: 0,
      connectTimeout: 60000,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
      dateStrings: true
    })
  } catch (err) {
    console.error('[pool] MySQL pool init failed:', err.message)
  }
}

/** Sanitize params for MySQL: undefined -> null (fixes mysqld_stmt_execute) */
function sanitizeParams(params) {
  if (!Array.isArray(params)) return []
  return params.map((p) => (p === undefined ? null : p))
}

/** Query wrapper - returns { rows, insertId } for compatibility with pg-style code */
export async function query(text, params = []) {
  if (!pool) throw new Error('Database not configured. Set DATABASE_URL (mysql://...).')
  const sql = text.replace(/\$(\d+)/g, () => '?')
  const args = sanitizeParams(params)
  const [result] = await pool.execute(sql, args)
  const rows = Array.isArray(result) ? result : []
  const insertId = result?.insertId
  const affectedRows = result?.affectedRows
  return { rows, insertId, affectedRows }
}

export function getPool() {
  return pool
}

export function isConnected() {
  return !!pool
}

/** Database name from connection URL (e.g. padel_db from mysql://.../padel_db) */
function databaseNameFromUrl(url) {
  if (!url || typeof url !== 'string') return null
  const parts = url.trim().split('/').filter(Boolean)
  const last = parts[parts.length - 1]
  return (last && last.split('?')[0]) || null
}

/** Return current MySQL database name (e.g. padel_db). Resolves to null if not connected. */
export async function getCurrentDatabase() {
  if (!pool) return null
  try {
    const { rows } = await query('SELECT DATABASE() AS db')
    return (rows && rows[0] && rows[0].db) || null
  } catch {
    return null
  }
}

/** للتشخيص: أين يُقرأ الاتصال من؟ */
export function getDbDiagnostics() {
  const cwd = process.cwd()
  const configPaths = [
    join(root, 'database.config.json'),
    join(cwd, 'database.config.json'),
    join(cwd, '..', 'database.config.json'),
    join(cwd, '..', '..', 'database.config.json'),
    join(cwd, '..', '..', '..', 'database.config.json'),
    join(cwd, '..', '..', '..', '..', 'database.config.json'),
    join(root, '..', 'database.config.json'),
    join(root, '..', '..', 'database.config.json'),
    join(root, '..', '..', '..', 'database.config.json'),
    join(root, '..', '..', '..', '..', 'database.config.json')
  ]
  const found = configPaths.find(p => existsSync(p))
  let fromFile = ''
  if (found) {
    try {
      const data = JSON.parse(readFileSync(found, 'utf8'))
      fromFile = (data.url || data.DATABASE_URL || data.connectionString || '').trim()
    } catch (e) {
      fromFile = '(parse error: ' + e.message + ')'
    }
  }
  const fromEnv = (process.env.DATABASE_URL || process.env.MYSQL_URL || '').trim()
  const used = fromEnv || fromFile
  return {
    cwd,
    root,
    fromEnv: !!fromEnv,
    configFileFound: found || null,
    configPaths: configPaths.map(p => ({ path: p, exists: existsSync(p) })),
    hasConnectionString: !!used,
    connectionHost: used ? (used.match(/@([^\/]+)\//) || [])[1] : null,
    databaseNameFromUrl: databaseNameFromUrl(used),
    poolExists: !!pool
  }
}
