/**
 * Background jobs for booking system - expire locks, expire unpaid bookings
 */
import * as lock from '../db/bookingLock.js'
import * as slotCache from '../lib/slotCache.js'
import { query } from '../db/pool.js'
import * as bookingService from '../services/bookingService.js'

let intervalId = null

async function expireLocks() {
  try {
    const count = await lock.expireStaleLocks()
    if (count > 0) console.log('[jobs] Expired', count, 'stale booking locks')
  } catch (e) {
    console.error('[jobs] expireLocks error:', e.message)
  }
}

async function expireUnpaidBookings() {
  try {
    const { rows } = await query(`
      SELECT id, club_id, booking_date FROM club_bookings
      WHERE status IN ('initiated', 'locked', 'pending_payments', 'partially_paid')
      AND payment_deadline_at IS NOT NULL AND payment_deadline_at < NOW()
    `)
    for (const b of rows || []) {
      await lock.deleteLockByBooking(b.id)
      const dateStr = b.booking_date ? String(b.booking_date).split('T')[0] : null
      if (b.club_id && dateStr) slotCache.invalidateLocks(b.club_id, dateStr)
    }
    const count = await bookingService.expireUnpaidBookings()
    if (count > 0) console.log('[jobs] Expired', count, 'unpaid bookings')
  } catch (e) {
    if (!e?.message?.includes('Unknown column')) console.error('[jobs] expireUnpaidBookings error:', e.message)
  }
}

async function runJobs() {
  await expireLocks()
  await expireUnpaidBookings()
}

export function startBookingJobs() {
  if (intervalId) return
  runJobs()
  intervalId = setInterval(runJobs, 60 * 1000)
  console.log('[jobs] Booking jobs started (every 60s)')
}

export function stopBookingJobs() {
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
    console.log('[jobs] Booking jobs stopped')
  }
}
