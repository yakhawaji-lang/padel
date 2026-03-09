/**
 * Run Booking System V2 migration - CLI entry
 * Usage: node server/scripts/run-booking-system-v2-migration.js
 */
import { runMigration } from '../db/bookingMigration.js'

console.log('Starting Booking System V2 migration...')
runMigration()
  .then(() => { console.log('Migration completed.'); process.exit(0) })
  .catch((e) => { console.error('Migration failed:', e?.message || e); process.exit(1) })
