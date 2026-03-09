/**
 * Booking slot lock - prevents double booking.
 * Uses booking_slot_locks table. Locks expire automatically (cleanup via job).
 */
import { query } from './pool.js'
import crypto from 'crypto'

const LOCK_MINUTES_DEFAULT = 10
const STATUS_ACTIVE = ['initiated', 'locked', 'pending_payments', 'partially_paid', 'confirmed']

export async function acquireLock(clubId, courtId, date, startTime, endTime, memberId, lockMinutes = LOCK_MINUTES_DEFAULT) {
  const lockId = `lock_${crypto.randomBytes(16).toString('hex')}`
  const expiresAt = new Date(Date.now() + lockMinutes * 60 * 1000)
  try {
    // Check no conflicting lock or confirmed booking
    const conflict = await hasConflict(clubId, courtId, date, startTime, endTime, null)
    if (conflict) return { ok: false, error: 'SLOT_TAKEN', conflict }
    await query(
      `INSERT INTO booking_slot_locks (id, club_id, court_id, booking_date, start_time, end_time, member_id, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [lockId, clubId, courtId, date, startTime, endTime, memberId, expiresAt]
    )
    return { ok: true, lockId, expiresAt }
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY' || e.message?.includes('Duplicate')) {
      return { ok: false, error: 'SLOT_TAKEN' }
    }
    throw e
  }
}

export async function releaseLock(lockId) {
  const { affectedRows } = await query('DELETE FROM booking_slot_locks WHERE id = ?', [lockId])
  return (affectedRows ?? 0) > 0
}

export async function hasConflict(clubId, courtId, date, startTime, endTime, excludeBookingId = null) {
  // Check locks (excluding expired)
  const { rows: locks } = await query(
    `SELECT id FROM booking_slot_locks 
     WHERE club_id = ? AND court_id = ? AND booking_date = ? 
     AND expires_at > NOW()
     AND start_time < ? AND end_time > ?`,
    [clubId, courtId, date, endTime, startTime]
  )
  if (locks.length > 0) return { type: 'lock', id: locks[0].id }
  // Check bookings (active statuses)
  let sql = `SELECT id FROM club_bookings 
     WHERE club_id = ? AND court_id = ? AND booking_date = ? AND deleted_at IS NULL
     AND status IN (?, ?, ?, ?, ?)
     AND (COALESCE(start_time, time_slot) < ?) AND (end_time IS NULL OR end_time > ?)`
  const params = [clubId, courtId, date, ...STATUS_ACTIVE, endTime, startTime]
  if (excludeBookingId) {
    sql += ' AND id != ?'
    params.push(excludeBookingId)
  }
  const { rows: bookings } = await query(sql, params)
  if (bookings.length > 0) return { type: 'booking', id: bookings[0].id }
  return null
}

export async function convertLockToBooking(lockId, bookingId) {
  await query('UPDATE booking_slot_locks SET booking_id = ? WHERE id = ?', [bookingId, lockId])
}

export async function deleteLockByBooking(bookingId) {
  await query('DELETE FROM booking_slot_locks WHERE booking_id = ?', [bookingId])
}

export async function expireStaleLocks() {
  const { affectedRows } = await query('DELETE FROM booking_slot_locks WHERE expires_at < NOW()')
  return affectedRows ?? 0
}

export async function getLockByMember(clubId, courtId, date, startTime, memberId) {
  const { rows } = await query(
    `SELECT id, expires_at FROM booking_slot_locks 
     WHERE club_id = ? AND court_id = ? AND booking_date = ? AND start_time = ? AND member_id = ? AND expires_at > NOW()`,
    [clubId, courtId, date, startTime, memberId]
  )
  return rows[0] || null
}
