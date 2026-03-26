/**
 * Booking slot lock - prevents double booking.
 * Uses booking_slot_locks table. Locks expire automatically (cleanup via job).
 * Supports intervals that cross midnight (end_time < start_time on same booking_date).
 */
import { query } from './pool.js'
import crypto from 'crypto'

const LOCK_MINUTES_DEFAULT = 10
const STATUS_ACTIVE = ['initiated', 'locked', 'pending_payments', 'pending_payment', 'partially_paid', 'confirmed']

function addDaysStr(isoDate, deltaDays) {
  const [y, m, d] = (isoDate || '').toString().split('-').map(Number)
  if (!y || !m || !d) return null
  const dt = new Date(y, m - 1, d + deltaDays)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

function timeToMin(t) {
  if (!t || typeof t !== 'string') return 0
  const [h, mm] = t.trim().split(':').map(Number)
  return (h || 0) * 60 + (mm || 0)
}

/** @param {Record<string, [number, number][]>} segmentsByDate */
function addIntervalSegments(segmentsByDate, bookingDate, startTime, endTime) {
  const s = timeToMin(startTime)
  const e = timeToMin(endTime)
  const push = (dateKey, seg) => {
    if (!segmentsByDate[dateKey]) segmentsByDate[dateKey] = []
    segmentsByDate[dateKey].push(seg)
  }
  if (e > s) {
    push(bookingDate, [s, e])
  } else if (e < s) {
    push(bookingDate, [s, 1440])
    const nd = addDaysStr(bookingDate, 1)
    if (nd) push(nd, [0, e])
  }
}

function segmentsOverlap(a, b) {
  return a[0] < b[1] && a[1] > b[0]
}

function anySegmentConflict(candidateByDate, existingByDate) {
  for (const day of Object.keys(candidateByDate)) {
    const csegs = candidateByDate[day]
    const esegs = existingByDate[day]
    if (!csegs || !esegs) continue
    for (const c of csegs) {
      for (const e of esegs) {
        if (segmentsOverlap(c, e)) return true
      }
    }
  }
  return false
}

export async function acquireLock(clubId, courtId, date, startTime, endTime, memberId, lockMinutes = LOCK_MINUTES_DEFAULT) {
  const lockId = `lock_${crypto.randomBytes(16).toString('hex')}`
  const expiresAt = new Date(Date.now() + lockMinutes * 60 * 1000)
  try {
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
  const prev = addDaysStr(date, -1)
  const next = addDaysStr(date, 1)
  const datesIn = [prev, date, next].filter(Boolean)

  const candidateMap = {}
  addIntervalSegments(candidateMap, date, startTime, endTime)

  const { rows: locks } = await query(
    `SELECT id, booking_date, start_time, end_time FROM booking_slot_locks 
     WHERE club_id = ? AND court_id = ? AND booking_date IN (?, ?, ?) 
     AND expires_at > NOW()`,
    [clubId, courtId, ...datesIn]
  )
  for (const row of locks || []) {
    const em = {}
    addIntervalSegments(em, row.booking_date, row.start_time, row.end_time)
    if (anySegmentConflict(candidateMap, em)) return { type: 'lock', id: row.id }
  }

  let sql = `SELECT id, booking_date, start_time, end_time, time_slot FROM club_bookings 
     WHERE club_id = ? AND court_id = ? AND booking_date IN (?, ?, ?) AND deleted_at IS NULL
     AND status IN (?, ?, ?, ?, ?, ?)`
  const params = [clubId, courtId, ...datesIn, ...STATUS_ACTIVE]
  if (excludeBookingId) {
    sql += ' AND id != ?'
    params.push(excludeBookingId)
  }
  const { rows: bookings } = await query(sql, params)
  for (const row of bookings || []) {
    const st = (row.start_time || row.time_slot || '').toString().trim()
    let en = (row.end_time || '').toString().trim()
    if (!st) continue
    if (!en) {
      const m = timeToMin(st) + 60
      en = `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
    }
    const em = {}
    addIntervalSegments(em, row.booking_date, st, en)
    if (anySegmentConflict(candidateMap, em)) return { type: 'booking', id: row.id }
  }
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
