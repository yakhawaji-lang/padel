/**
 * PostgreSQL query helper for Vercel Serverless Functions.
 * Uses DATABASE_URL or POSTGRES_URL from Vercel env.
 */
import pg from 'pg'
const { Pool } = pg

const connectionString = (process.env.DATABASE_URL || process.env.POSTGRES_URL || '').trim()
const pool = connectionString
  ? new Pool({
      connectionString,
      ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000
    })
  : null

export async function query(text, params) {
  if (!pool) throw new Error('Database not configured. Set DATABASE_URL or POSTGRES_URL.')
  return pool.query(text, params)
}

export function isConnected() {
  return !!pool
}
