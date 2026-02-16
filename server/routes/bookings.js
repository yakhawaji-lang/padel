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
import * as bookingService from '../services/bookingService.js'
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

function isBookingInPast(dateStr, startTime) {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false
  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  if (dateStr < today) return true
  if (dateStr > today) return false
  const [h, m] = (startTime || '00:00').toString().trim().split(':').map(Number)
  const slotM = (h || 0) * 60 + (m || 0)
  const nowM = now.getHours() * 60 + now.getMinutes()
  return slotM <= nowM
}

/** POST /api/bookings/lock - Acquire soft lock */
router.post('/lock', async (req, res) => {
  try {
    const { clubId, courtId, date: dateRaw, startTime, endTime, memberId, lockMinutes } = req.body || {}
    if (!clubId || !courtId || !dateRaw || !startTime || !endTime || !memberId) {
      return res.status(400).json({ error: 'clubId, courtId, date, startTime, endTime, memberId required' })
    }
    const date = (dateRaw || '').toString().replace(/T.*$/, '').trim().substring(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' })
    }
    if (isBookingInPast(date, startTime)) {
      return res.status(400).json({ error: 'Cannot book a date or time in the past.' })
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

    const { lockId, clubId, courtId, date: dateRaw, startTime, endTime, memberId, memberName, totalAmount, paymentMethod, paymentShares, idempotencyKey } = req.body || {}
    if (!lockId || !clubId || !courtId || !dateRaw || !startTime || !endTime || !memberId) {
      return res.status(400).json({ error: 'lockId, clubId, courtId, date, startTime, endTime, memberId required' })
    }
    const date = (dateRaw || '').toString().replace(/T.*$/, '').trim().substring(0, 10)

    if (idempotencyKey) {
      const existing = await idempotency.checkIdempotency(idempotencyKey)
      if (existing) return res.json({ ok: true, bookingId: existing, status: 'confirmed', idempotent: true })
    }

    const actor = getActorFromRequest(req)

    const bid = `bk_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
    const settings = await getBookingSettings(clubId)
    const payAtClub = paymentMethod === 'at_club'
    const hasShares = Array.isArray(paymentShares) && paymentShares.length > 0
    const status = payAtClub ? 'confirmed' : (hasShares ? 'pending_payments' : 'confirmed')
    const paidAmount = (payAtClub || !hasShares) ? (totalAmount || 0) : 0
    const paymentDeadlineMinutes = !payAtClub && hasShares ? settings.splitPaymentDeadlineMinutes : null
    const paymentDeadline = paymentDeadlineMinutes != null
      ? new Date(Date.now() + paymentDeadlineMinutes * 60 * 1000)
      : null

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' })
    }
    if (isBookingInPast(date, startTime)) {
      return res.status(400).json({ error: 'Cannot book a date or time in the past.' })
    }

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

    await bookingService.createBooking({
      id: bid,
      clubId,
      courtId,
      memberId,
      date,
      timeSlot: startTime,
      startTime,
      endTime,
      status,
      totalAmount: totalAmount || 0,
      paidAmount,
      initiatorMemberId: memberId,
      paymentDeadline,
      dataJson: JSON.stringify(bData),
      createdBy: actor.actorId || null
    })

    await lock.convertLockToBooking(lockId, bid)
    await lock.releaseLock(lockId)
    slotCache.invalidateLocks(clubId, date)

    const basePath = (process.env.BASE_PATH || '/app').replace(/\/$/, '')
    const ref = req.headers.origin || req.headers.referer || ''
    const origin = ref ? (() => { try { return new URL(ref).origin } catch (_) { return ref.replace(/\/$/, '') } })() : ''
    const baseUrl = process.env.BASE_URL || process.env.PUBLIC_BASE_URL || (origin ? `${origin}${basePath}` : 'https://playtix.app/app')
    const createdShares = []

    for (const s of paymentShares || []) {
      const token = s.type === 'unregistered' ? `inv_${crypto.randomBytes(16).toString('hex')}` : null
      const payUrl = token ? `${baseUrl.replace(/\/$/, '')}/pay-invite/${token}` : null
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
    await bookingService.cancelBooking(bookingId, clubId, actor)
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
    await bookingService.updateBookingPayment(bid, clubId, paidAmount, status)
    const { rows: bDate } = await query('SELECT booking_date FROM club_bookings WHERE id = ? AND club_id = ?', [bid, clubId])
    const dateStr = bDate[0]?.booking_date ? String(bDate[0].booking_date).split('T')[0] : null
    if (clubId && dateStr) slotCache.invalidateLocks(clubId, dateStr)
    res.json({ ok: true, paidAmount, status })
  } catch (e) {
    console.error('bookings record-payment error:', e)
    res.status(500).json({ error: dbError(e) })
  }
})

/** POST /api/bookings/mark-pay-at-club - Extend deadline to end of booking date so booking is not expired; user will pay at club (cash/card) */
router.post('/mark-pay-at-club', async (req, res) => {
  try {
    const normalized = await hasNormalizedTables()
    if (!normalized) return res.status(400).json({ error: 'Normalized tables required' })
    const { bookingId, clubId } = req.body || {}
    if (!bookingId || !clubId) return res.status(400).json({ error: 'bookingId and clubId required' })
    const { rows } = await query(
      'SELECT id, booking_date, status FROM club_bookings WHERE id = ? AND club_id = ? AND deleted_at IS NULL',
      [bookingId, clubId]
    )
    if (!rows?.length) return res.status(404).json({ error: 'Booking not found' })
    const b = rows[0]
    if (!['pending_payments', 'partially_paid'].includes(b.status || '')) {
      return res.status(400).json({ error: 'Booking is not awaiting payment' })
    }
    const dateStr = b.booking_date ? String(b.booking_date).split('T')[0] : null
    const deadlineEndOfDay = dateStr ? new Date(dateStr + 'T23:59:59') : new Date(Date.now() + 24 * 60 * 60 * 1000)
    await bookingService.updateBookingPaymentDeadline(bookingId, clubId, deadlineEndOfDay)
    if (clubId && dateStr) slotCache.invalidateLocks(clubId, dateStr)
    res.json({ ok: true, paymentDeadlineAt: deadlineEndOfDay })
  } catch (e) {
    console.error('bookings mark-pay-at-club error:', e)
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
