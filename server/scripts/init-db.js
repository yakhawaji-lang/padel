import { config } from 'dotenv'
import pg from 'pg'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: join(__dirname, '../..', '.env.local') })
config({ path: join(__dirname, '../..', '.env') })

let connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL

if (!connectionString) {
  console.error('Set DATABASE_URL or POSTGRES_URL')
  process.exit(1)
}

// Create database if it doesn't exist (connect to postgres first)
function getDbName(cs) {
  try {
    const u = new URL(cs.replace(/^postgresql:/, 'https:'))
    const name = (u.pathname || '').replace(/^\//, '').split('/')[0] || 'padel'
    return name || 'padel'
  } catch { return 'padel' }
}
function getBaseUrl(cs) {
  const name = getDbName(cs)
  return cs.replace(/\/[^/]*(\?|$)/, '/postgres$1')
}
const dbName = getDbName(connectionString)
const baseUrl = getBaseUrl(connectionString)

async function ensureDb() {
  const admin = new pg.Client({ connectionString: baseUrl })
  await admin.connect()
  const { rows } = await admin.query(
    "SELECT 1 FROM pg_database WHERE datname = $1",
    [dbName]
  )
  if (rows.length === 0) {
    await admin.query('CREATE DATABASE "' + dbName.replace(/"/g, '""') + '"')
    console.log('Created database:', dbName)
  }
  await admin.end()
}

let client = new pg.Client({ connectionString })
try {
  await client.connect()
} catch (e) {
  if (e.code === '3D000' && e.message?.includes('does not exist')) {
    try {
      await ensureDb()
    } catch (createErr) {
      console.error('Could not create database:', createErr.message)
      process.exit(1)
    }
    client = new pg.Client({ connectionString })
    await client.connect()
  } else {
    throw e
  }
}

try {
  const sql = readFileSync(join(__dirname, '../db/schema.sql'), 'utf8')
  await client.query(sql)
  console.log('Database initialized successfully')
} catch (e) {
  console.error('Init failed:', e)
  process.exit(1)
} finally {
  await client.end()
}
