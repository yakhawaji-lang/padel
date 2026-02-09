/**
 * Run booking_payment_shares migration on u502561206_padel_db
 * Uses DATABASE_URL or database.config.json from project root
 */
import { query } from '../db/pool.js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const sqlPath = join(__dirname, '../db/migrations/add-booking-payment-shares-table.sql')

async function run() {
  try {
    const sql = readFileSync(sqlPath, 'utf8')
    await query(sql)
    console.log('booking_payment_shares table created/verified successfully.')
  } catch (e) {
    console.error('Migration failed:', e?.message || e)
    if (e?.message?.includes('not configured')) {
      console.error('Ensure DATABASE_URL (mysql://...) or database.config.json is set.')
    }
    process.exit(1)
  }
  process.exit(0)
}

run()
