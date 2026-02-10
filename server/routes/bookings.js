/**
 * Bookings API - Lock, Confirm, Cancel, Locks list
 * Prevents double booking via booking_slot_locks
 */
import { Router } from 'express'
import crypto from 'crypto'
import { query } from '../db/pool.js'
import { getActorFromRequest } from '../db/audit.js'
import { logAudit } from '../db/audit.js'
import * as lock from '../db/bookingLock.js'
import { hasNormalizedTables } from '../db/normalizedData.js'

const router = Router()

function dbError(e) {
  return e?.message || 'Database error'
}

/** GET /api/bookings/locks - Active locks for a club/date (for grid display) */
router.get('/locks', async (req, res) => {
  try {
    const { clubId, date } = req.query
    if (!clubId || !date) return res.status(400).json({ error: 'clubId and date required' })
    const { rows } = await query(
      `SELECT id, club_id, court_id, booking_date, start_time, end_time, member_id, expires_at 
       FROM booking_slot_locks WHERE club_id = ? AND booking_date = ? AND expires_at > NOW()`,
      [clubId, date]
    )
    res.json(rows || [])
  } catch (e) {
    console.error('bookings locks error:', e)
    res.status(500).json({ error: dbError(e) })
  }
})

/** POST /api/bookings/lock - Acquire soft lock */
router.post('/lock', async (req, res) => {
  try {
    const { clubId, courtId, date, startTime, endTime, memberId, lockMinutes } = req.body || {}
    if (!clubId || !courtId || !date || !startTime || !endTime || !memberId) {
      return res.status(400).json({ error: 'clubId, courtId, date, startTime, endTime, memberId required' })
    }
    const result = await lock.acquireLock(clubId, courtId, date, startTime, endTime, memberId, lockMinutes || 10)
    if (!result.ok) {
      return res.status(409).json({ error: result.error || 'SLOT_TAKEN', conflict: result.conflict })
    }
    res.json({ lockId: result.lockId, expiresAt: result.expiresAt })
  } catch (e) {
    console.error('bookings lock error:', e)
    res.status(500).json({ error: dbError(e) })
  }
})

/** POST /api/bookings/release-lock - Release lock without booking */
router.post('/release-lock', async (req, res) => {
  try {
    const { lockId } = req.body || {}
    if (!lockId) return res.status(400).json({ error: 'lockId required' })
    const ok = await lock.releaseLock(lockId)
    res.json({ ok })
  } catch (e) {
    console.error('bookings release-lock error:', e)
    res.status(500).json({ error: dbError(e) })
  }
})

/** POST /api/bookings/confirm - Confirm booking (create from lock) */
router.post('/confirm', async (req, res) => {
  try {
    const normalized = await hasNormalizedTables()
    if (!normalized) return res.status(400).json({ error: 'Normalized tables required' })

    const { lockId, clubId, courtId, date, startTime, endTime, memberId, memberName, totalAmount, paymentShares, idempotencyKey } = req.body || {}
    if (!lockId || !clubId || !courtId || !date || !startTime || !endTime || !memberId) {
      return res.status(400).json({ error: 'lockId, clubId, courtId, date, startTime, endTime, memberId required' })
    }

    const actor = getActorFromRequest(req)

    const bid = `bk_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
    const status = paymentShares?.length > 0 ? 'pending_payments' : 'confirmed'
    const paidAmount = paymentShares?.length > 0 ? 0 : (totalAmount || 0)
    const paymentDeadline = paymentShares?.length > 0
      ? new Date(Date.now() + 30 * 60 * 1000)
      : null

    const bData = {
      resource: courtId,
      court: courtId,
      courtName: courtId,
      customerName: memberName,
      customer: memberName,
      price: totalAmount,
      durationMinutes: ((s, e) => {
        const [sh, sm] = (s || '0:0').split(':').map(Number)
        const [eh, em] = (e || '0:0').split(':').map(Number)
        return (eh * 60 + em) - (sh * 60 + sm)
      })(startTime, endTime),
      paymentShares: paymentShares || []
    }

    await query(
      `INSERT INTO club_bookings (id, club_id, court_id, member_id, booking_date, time_slot, start_time, end_time, status, total_amount, paid_amount, initiator_member_id, locked_at, payment_deadline_at, data, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?)`,
      [bid, clubId, courtId, memberId, date, startTime, startTime, endTime, status, totalAmount || 0, paidAmount, memberId, paymentDeadline, JSON.stringify(bData), actor.actorId || null]
    )

    await lock.convertLockToBooking(lockId, bid)
    await lock.releaseLock(lockId)

    for (const s of paymentShares || []) {
      const token = s.type === 'unregistered' ? `inv_${crypto.randomBytes(16).toString('hex')}` : null
      await query(
        `INSERT INTO booking_payment_shares (booking_id, club_id, participant_type, member_id, member_name, phone, amount, whatsapp_link, invite_token)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [bid, clubId, s.type || 'registered', s.memberId || null, s.memberName || null, s.phone || null, parseFloat(s.amount) || 0, s.whatsappLink || null, token]
      )
    }

    await logAudit({ tableName: 'club_bookings', recordId: bid, action: 'INSERT', ...actor, clubId, newValue: { status, memberId } })

    res.json({ ok: true, bookingId: bid, status })
  } catch (e) {
    console.error('bookings confirm error:', e)
    res.status(500).json({ error: dbError(e) })
  }
})

/** POST /api/bookings/cancel - Cancel booking or lock */
router.post('/cancel', async (req, res) => {
  try {
    const { bookingId, lockId } = req.body || {}
    const actor = getActorFromRequest(req)
    if (lockId) {
      const ok = await lock.releaseLock(lockId)
      return res.json({ ok, type: 'lock' })
    }
    if (!bookingId) return res.status(400).json({ error: 'bookingId or lockId required' })
    const { rows } = await query('SELECT club_id, total_amount, member_id FROM club_bookings WHERE id = ? AND deleted_at IS NULL', [bookingId])
    if (rows.length === 0) return res.status(404).json({ error: 'Booking not found' })
    const clubId = rows[0].club_id
    const totalAmount = parseFloat(rows[0].total_amount) || 0
    const memberId = rows[0].member_id
    await query('UPDATE club_bookings SET status = ?, deleted_at = NOW(), deleted_by = ? WHERE id = ? AND club_id = ?', ['cancelled', actor.actorId || null, bookingId, clubId])
    await lock.deleteLockByBooking(bookingId)
    if (totalAmount > 0 && memberId) {
      const refundDays = 3
      const expectedBy = new Date()
      expectedBy.setDate(expectedBy.getDate() + refundDays)
      try {
        await query(
          'INSERT INTO booking_refunds (booking_id, club_id, member_id, amount, status, expected_by_date) VALUES (?, ?, ?, ?, ?, ?)',
          [bookingId, clubId, memberId, totalAmount, 'pending', expectedBy.toISOString().split('T')[0]]
        )
      } catch (e) {
        if (!e?.message?.includes("doesn't exist")) console.warn('booking_refunds insert:', e?.message)
      }
    }
    await logAudit({ tableName: 'club_bookings', recordId: bookingId, action: 'UPDATE', ...actor, clubId, newValue: { status: 'cancelled' } })
    res.json({ ok: true, type: 'booking' })
  } catch (e) {
    console.error('bookings cancel error:', e)
    res.status(500).json({ error: dbError(e) })
  }
})

/** POST /api/bookings/expire-locks - Cron job: expire stale locks */
router.post('/expire-locks', async (req, res) => {
  try {
    const count = await lock.expireStaleLocks()
    res.json({ ok: true, expired: count })
  } catch (e) {
    console.error('bookings expire-locks error:', e)
    res.status(500).json({ error: dbError(e) })
  }
})

export default router
