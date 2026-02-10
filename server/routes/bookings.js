/**
 * Bookings API - Lock, Confirm, Cancel, Locks list
 * Prevents double booking via booking_slot_locks
 */
import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import crypto from 'crypto'
import { query } from '../db/pool.js'
import { getActorFromRequest } from '../db/audit.js'
import { logAudit } from '../db/audit.js'
import * as lock from '../db/bookingLock.js'
import * as idempotency from '../db/idempotency.js'
import { getBookingSettings } from '../db/bookingSettings.js'
import { hasNormalizedTables } from '../db/normalizedData.js'
import * as slotCache from '../lib/slotCache.js'

const router = Router()

const bookingRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Too many requests. Try again later.' },
  standardHeaders: true,
  legacyHeaders: false
})
router.use(bookingRateLimit)

function dbError(e) {
  return e?.message || 'Database error'
}

/** GET /api/bookings/locks - Active locks for a club/date (cached 30s) */
router.get('/locks', async (req, res) => {
  try {
    const { clubId, date } = req.query
    if (!clubId || !date) return res.status(400).json({ error: 'clubId and date required' })
    const cached = slotCache.getCachedLocks(clubId, date)
    if (cached) return res.json(cached)
    const { rows } = await query(
      `SELECT id, club_id, court_id, booking_date, start_time, end_time, member_id, expires_at 
       FROM booking_slot_locks WHERE club_id = ? AND booking_date = ? AND expires_at > NOW()`,
      [clubId, date]
    )
    const data = rows || []
    slotCache.setCachedLocks(clubId, date, data)
    res.json(data)
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
    slotCache.invalidateLocks(clubId, date)
    res.json({ lockId: result.lockId, expiresAt: result.expiresAt })
  } catch (e) {
    console.error('bookings lock error:', e)
    res.status(500).json({ error: dbError(e) })
  }
})

/** POST /api/bookings/release-lock - Release lock without booking */
router.post('/release-lock', async (req, res) => {
  try {
    const { lockId, clubId, date } = req.body || {}
    if (!lockId) return res.status(400).json({ error: 'lockId required' })
    const ok = await lock.releaseLock(lockId)
    if (clubId && date) slotCache.invalidateLocks(clubId, date)
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

    if (idempotencyKey) {
      const existing = await idempotency.checkIdempotency(idempotencyKey)
      if (existing) return res.json({ ok: true, bookingId: existing, status: 'confirmed', idempotent: true })
    }

    const actor = getActorFromRequest(req)

    const bid = `bk_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
    const settings = await getBookingSettings(clubId)
    const status = paymentShares?.length > 0 ? 'pending_payments' : 'confirmed'
    const paidAmount = paymentShares?.length > 0 ? 0 : (totalAmount || 0)
    const paymentDeadlineMinutes = paymentShares?.length > 0 ? settings.splitPaymentDeadlineMinutes : null
    const paymentDeadline = paymentDeadlineMinutes != null
      ? new Date(Date.now() + paymentDeadlineMinutes * 60 * 1000)
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
    slotCache.invalidateLocks(clubId, date)

    const baseUrl = (req.headers.origin || req.headers.referer || '').replace(/\/$/, '') || 'https://playtix.app'
    const createdShares = []

    for (const s of paymentShares || []) {
      const token = s.type === 'unregistered' ? `inv_${crypto.randomBytes(16).toString('hex')}` : null
      const payUrl = token ? `${baseUrl}/pay-invite/${token}` : null
      const waLink = (payUrl ? `https://wa.me/?text=${encodeURIComponent(payUrl)}` : null) || s.whatsappLink
      await query(
        `INSERT INTO booking_payment_shares (booking_id, club_id, participant_type, member_id, member_name, phone, amount, whatsapp_link, invite_token)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [bid, clubId, s.type || 'registered', s.memberId || null, s.memberName || null, s.phone || null, parseFloat(s.amount) || 0, waLink || null, token]
      )
      createdShares.push({ ...s, inviteToken: token, payInviteUrl: payUrl })
    }

    if (idempotencyKey) await idempotency.storeIdempotency(idempotencyKey, bid)

    await logAudit({ tableName: 'club_bookings', recordId: bid, action: 'INSERT', ...actor, clubId, newValue: { status, memberId } })

    res.json({ ok: true, bookingId: bid, status, paymentShares: createdShares })
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
    const bookingDate = rows[0]?.booking_date ? String(rows[0].booking_date).split('T')[0] : null
    const settings = await getBookingSettings(clubId)
    await query('UPDATE club_bookings SET status = ?, deleted_at = NOW(), deleted_by = ? WHERE id = ? AND club_id = ?', ['cancelled', actor.actorId || null, bookingId, clubId])
    await lock.deleteLockByBooking(bookingId)
    if (bookingDate) slotCache.invalidateLocks(clubId, bookingDate)
    if (totalAmount > 0 && memberId) {
      const refundDays = settings.refundDays
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

/** POST /api/bookings/record-payment - Record payment for a share (update paid_at, recalc status) */
router.post('/record-payment', async (req, res) => {
  try {
    const { shareId, inviteToken, clubId, paymentReference } = req.body || {}
    if (!clubId) return res.status(400).json({ error: 'clubId required' })
    let shareRows
    if (shareId) {
      const r = await query('SELECT id, booking_id, amount FROM booking_payment_shares WHERE id = ? AND club_id = ?', [shareId, clubId])
      shareRows = r.rows
    } else if (inviteToken) {
      const r = await query('SELECT id, booking_id, amount FROM booking_payment_shares WHERE invite_token = ? AND club_id = ?', [inviteToken, clubId])
      shareRows = r.rows
    } else {
      return res.status(400).json({ error: 'shareId or inviteToken required' })
    }
    if (!shareRows?.length) return res.status(404).json({ error: 'Share not found' })
    const share = shareRows[0]
    const bid = share.booking_id
    await query(
      'UPDATE booking_payment_shares SET paid_at = NOW(), payment_reference = ? WHERE id = ? AND club_id = ?',
      [paymentReference || null, share.id, clubId]
    )
    const { rows: shares } = await query(
      'SELECT amount, paid_at FROM booking_payment_shares WHERE booking_id = ? AND club_id = ?',
      [bid, clubId]
    )
    const paidAmount = (shares || []).reduce((sum, s) => sum + (s.paid_at ? parseFloat(s.amount) || 0 : 0), 0)
    const { rows: bRows } = await query('SELECT total_amount FROM club_bookings WHERE id = ? AND club_id = ? AND deleted_at IS NULL', [bid, clubId])
    const totalAmount = parseFloat(bRows[0]?.total_amount) || 0
    const allPaid = paidAmount >= totalAmount - 0.01
    const status = allPaid ? 'confirmed' : (paidAmount > 0 ? 'partially_paid' : 'pending_payments')
    await query(
      'UPDATE club_bookings SET paid_amount = ?, status = ? WHERE id = ? AND club_id = ?',
      [paidAmount, status, bid, clubId]
    )
    const { rows: bDate } = await query('SELECT booking_date FROM club_bookings WHERE id = ? AND club_id = ?', [bid, clubId])
    const dateStr = bDate[0]?.booking_date ? String(bDate[0].booking_date).split('T')[0] : null
    if (clubId && dateStr) slotCache.invalidateLocks(clubId, dateStr)
    res.json({ ok: true, paidAmount, status })
  } catch (e) {
    console.error('bookings record-payment error:', e)
    res.status(500).json({ error: dbError(e) })
  }
})

/** GET /api/bookings/favorites - List favorite members for a member in a club */
router.get('/favorites', async (req, res) => {
  try {
    const { memberId, clubId } = req.query
    if (!memberId || !clubId) return res.status(400).json({ error: 'memberId and clubId required' })
    const { rows } = await query(
      `SELECT mf.favorite_member_id AS id
       FROM member_favorites mf
       WHERE mf.member_id = ? AND mf.club_id = ?`,
      [memberId, clubId]
    )
    const ids = (rows || []).map(r => r.id)
    res.json(ids)
  } catch (e) {
    console.error('bookings favorites get error:', e)
    res.status(500).json({ error: dbError(e) })
  }
})

/** POST /api/bookings/favorites - Add favorite member */
router.post('/favorites', async (req, res) => {
  try {
    const { memberId, clubId, favoriteMemberId } = req.body || {}
    if (!memberId || !clubId || !favoriteMemberId) {
      return res.status(400).json({ error: 'memberId, clubId, favoriteMemberId required' })
    }
    await query(
      `INSERT IGNORE INTO member_favorites (member_id, club_id, favorite_member_id) VALUES (?, ?, ?)`,
      [memberId, clubId, favoriteMemberId]
    )
    res.json({ ok: true })
  } catch (e) {
    console.error('bookings favorites post error:', e)
    res.status(500).json({ error: dbError(e) })
  }
})

/** DELETE /api/bookings/favorites - Remove favorite member */
router.delete('/favorites', async (req, res) => {
  try {
    const { memberId, clubId, favoriteMemberId } = req.query
    if (!memberId || !clubId || !favoriteMemberId) {
      return res.status(400).json({ error: 'memberId, clubId, favoriteMemberId required' })
    }
    await query(
      'DELETE FROM member_favorites WHERE member_id = ? AND club_id = ? AND favorite_member_id = ?',
      [memberId, clubId, favoriteMemberId]
    )
    res.json({ ok: true })
  } catch (e) {
    console.error('bookings favorites delete error:', e)
    res.status(500).json({ error: dbError(e) })
  }
})

/** GET /api/bookings/invite/:token - Get invite/share data by token */
router.get('/invite/:token', async (req, res) => {
  try {
    const { token } = req.params
    if (!token) return res.status(400).json({ error: 'Token required' })
    const { rows } = await query(
      `SELECT bps.id, bps.booking_id, bps.club_id, bps.participant_type, bps.member_id, bps.member_name, bps.phone, bps.amount, bps.invite_token,
              cb.court_id, cb.booking_date, cb.start_time, cb.end_time, cb.status AS booking_status, cb.total_amount
       FROM booking_payment_shares bps
       JOIN club_bookings cb ON cb.id = bps.booking_id AND cb.club_id = bps.club_id AND cb.deleted_at IS NULL
       WHERE bps.invite_token = ?`,
      [token]
    )
    if (!rows?.length) return res.status(404).json({ error: 'Invite not found' })
    const r = rows[0]
    res.json({
      inviteToken: r.invite_token,
      bookingId: r.booking_id,
      clubId: r.club_id,
      participantType: r.participant_type,
      memberId: r.member_id,
      memberName: r.member_name,
      phone: r.phone,
      amount: parseFloat(r.amount) || 0,
      courtId: r.court_id,
      bookingDate: r.booking_date ? String(r.booking_date).split('T')[0] : null,
      startTime: r.start_time,
      endTime: r.end_time,
      bookingStatus: r.booking_status,
      totalAmount: parseFloat(r.total_amount) || 0
    })
  } catch (e) {
    console.error('bookings invite get error:', e)
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
