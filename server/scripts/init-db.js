import pg from 'pg'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL

if (!connectionString) {
  console.error('Set DATABASE_URL or POSTGRES_URL')
  process.exit(1)
}

const client = new pg.Client({ connectionString })
try {
  await client.connect()
  const sql = readFileSync(join(__dirname, '../db/schema.sql'), 'utf8')
  await client.query(sql)
  console.log('Database initialized successfully')
} catch (e) {
  console.error('Init failed:', e)
  process.exit(1)
} finally {
  await client.end()
}
