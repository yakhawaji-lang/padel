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
import { normalizeBookingDateYmd } from '../services/bookingService.js'
import * as paymentShareRecalc from '../services/paymentShareRecalc.js'
import * as invoiceService from '../services/invoiceService.js'
import * as walletService from '../services/walletService.js'
import { computePolicyFee, hoursUntilBookingStart } from '../services/bookingPolicy.js'
import * as idempotency from '../db/idempotency.js'
import { getBookingSettings } from '../db/bookingSettings.js'
import { hasNormalizedTables, purgeClubBookingFromDb } from '../db/normalizedData.js'
import * as slotCache from '../lib/slotCache.js'
import { sendPlatformMessage } from '../services/messageSend.js'

function normalizeInviteTokenParamExpress(raw) {
  if (raw == null || raw === '') return ''
  let s = String(raw).trim()
  try {
    s = decodeURIComponent(s)
  } catch (_) {}
  s = s.replace(/[\s\u200e\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g, '')
  if (!s) return ''
  const noFrag = s.split(/[?#]/)[0]
  const m = noFrag.match(/^inv_([a-f0-9]{32})$/i)
  if (m) return `inv_${m[1].toLowerCase()}`
  return noFrag
}

/**
 * فاتورة حجز ملعب — دافع واحد، المبلغ المدفوع = الإجمالي، بدون صفوف booking_payment_shares.
 * idempotent عبر issueInvoiceForFullBookingPayment.
 */
async function issueFullBookingInvoiceIfConfirmedSinglePayer({
  clubId,
  bookingId,
  status,
  totalAmount,
  paidAmount,
  memberId,
  memberName,
  isWalletPay,
  isOnlinePayment,
  paymentMethodRaw,
}) {
  if ((status || '') !== 'confirmed') return
  const total = Math.round((parseFloat(totalAmount) || 0) * 100) / 100
  const paid = Math.round((parseFloat(paidAmount) || 0) * 100) / 100
  if (total < 0.01 || paid < total - 0.02) return
  if (!(await invoiceService.invoicingTablesExist())) return
  const { rows: cnt } = await query(
    'SELECT COUNT(*) AS c FROM booking_payment_shares WHERE booking_id = ? AND club_id = ?',
    [bookingId, clubId]
  )
  if (Number(cnt?.[0]?.c) > 0) return

  const { rows: csRows } = await query('SELECT currency FROM club_settings WHERE club_id = ? LIMIT 1', [clubId])
  const currency = csRows?.[0]?.currency || 'SAR'

  let invPm = 'electronic'
  if (isWalletPay) invPm = 'wallet'
  else if (isOnlinePayment) invPm = 'electronic'
  else invPm = invoiceService.normalizeClubPaymentMethodForInvoice(paymentMethodRaw)

  try {
    await invoiceService.issueInvoiceForFullBookingPayment({
      clubId,
      bookingId,
      amount: total,
      currency,
      memberId,
      memberName,
      paymentMethod: invPm,
    })
  } catch (e) {
    console.warn('[bookings] full-booking invoice:', e?.message)
  }
}

const router = Router()

const bookingRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  message: { error: 'Too many requests. Try again later.' },
  standardHeaders: true,
  legacyHeaders: false
})
router.use(bookingRateLimit)

function dbError(e) {
  return e?.message || 'Database error'
}

function addDaysBooking(isoDateStr, deltaDays) {
  const [y, mo, d] = (isoDateStr || '').toString().split('-').map(Number)
  if (!y || !mo || !d) return null
  const dt = new Date(y, mo - 1, d + deltaDays)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
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
    const nextInv = addDaysBooking(date, 1)
    if (nextInv) slotCache.invalidateLocks(clubId, nextInv)
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
  let walletRollback = null
  try {
    const normalized = await hasNormalizedTables()
    if (!normalized) return res.status(400).json({ error: 'Normalized tables required' })

    const { lockId, clubId, courtId, date: dateRaw, startTime, endTime, memberId, memberName, totalAmount, paymentMethod, initiatorPaymentMethod, paymentShares, idempotencyKey, remainderPaymentMethod } = req.body || {}
    if (!lockId || !clubId || !courtId || !dateRaw || !startTime || !endTime || !memberId) {
      return res.status(400).json({ error: 'lockId, clubId, courtId, date, startTime, endTime, memberId required' })
    }
    const date = (dateRaw || '').toString().replace(/T.*$/, '').trim().substring(0, 10)

    if (idempotencyKey) {
      const existing = await idempotency.checkIdempotency(idempotencyKey)
      if (existing) {
        try {
          const { rows: br } = await query(
            `SELECT status, total_amount, paid_amount, member_id, data FROM club_bookings WHERE id = ? AND club_id = ? AND deleted_at IS NULL`,
            [existing, clubId]
          )
          if (br?.length) {
            const bb = br[0]
            const d = parseBookingJsonData(bb.data)
            const isW = String(d.paymentMethod || '').toLowerCase() === 'wallet'
            let mn = memberName
            if (bb.member_id && !mn) {
              const mr = await query('SELECT name FROM members WHERE id = ? AND deleted_at IS NULL', [String(bb.member_id)])
              mn = mr?.rows?.[0]?.name || null
            }
            await issueFullBookingInvoiceIfConfirmedSinglePayer({
              clubId,
              bookingId: existing,
              status: bb.status,
              totalAmount: bb.total_amount,
              paidAmount: bb.paid_amount,
              memberId: bb.member_id,
              memberName: mn,
              isWalletPay: isW,
              isOnlinePayment: false,
              paymentMethodRaw: d.paymentMethod,
            })
          }
        } catch (e) {
          console.warn('[bookings confirm] idempotent invoice:', e?.message)
        }
        return res.json({ ok: true, bookingId: existing, status: 'confirmed', idempotent: true })
      }
    }

    const actor = getActorFromRequest(req)

    const bid = `bk_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
    const settings = await getBookingSettings(clubId)
    const payAtClub = paymentMethod === 'at_club'
    const isWalletPay = paymentMethod === 'wallet'
    const isOnlinePayment = paymentMethod === 'credit_card' || paymentMethod === 'mada'
    const hasShares = Array.isArray(paymentShares) && paymentShares.length > 0
    const payAtClubFull = payAtClub && !hasShares
    if (isWalletPay && hasShares) {
      return res.status(400).json({ error: 'Wallet is only available when you pay the full amount (not split).' })
    }
    let walletApplied = 0
    let walletRemainderTotal = 0
    let remainderPm = ''
    let walletHybridOnlineMethod = null
    let status
    let paidAmount
    if (isOnlinePayment) {
      status = 'pending_payment'
      paidAmount = 0
    } else if (isWalletPay && !hasShares) {
      const total = Math.round((parseFloat(totalAmount) || 0) * 100) / 100
      const balance = await walletService.getWalletBalance(clubId, memberId)
      walletApplied = Math.min(Math.max(0, balance), total)
      walletRemainderTotal = Math.round((total - walletApplied) * 100) / 100
      remainderPm = (remainderPaymentMethod || '').toString().toLowerCase().trim()
      if (walletRemainderTotal > 0.01) {
        if (!['at_club', 'credit_card', 'mada'].includes(remainderPm)) {
          return res.status(400).json({
            error: 'remainderPaymentMethod required (at_club, credit_card, or mada) when wallet balance does not cover the full amount.',
          })
        }
        paidAmount = walletApplied
        status = 'pending_payment'
        if (remainderPm === 'credit_card' || remainderPm === 'mada') walletHybridOnlineMethod = remainderPm
      } else {
        status = 'confirmed'
        paidAmount = total
      }
    } else if (payAtClubFull) {
      status = 'pending_payment'
      paidAmount = 0
    } else if (hasShares) {
      status = 'pending_payments'
      paidAmount = 0
    } else {
      status = 'confirmed'
      paidAmount = totalAmount || 0
    }
    const paymentDeadlineMinutes = !payAtClub && !isWalletPay && hasShares ? settings.splitPaymentDeadlineMinutes : null
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
        const startMin = (sh || 0) * 60 + (sm || 0)
        const endMin = (eh || 0) * 60 + (em || 0)
        if (endMin > startMin) return endMin - startMin
        return endMin + 1440 - startMin
      })(startTime, endTime),
      paymentShares: paymentShares || [],
      ...(isOnlinePayment && !isWalletPay && { paymentMethod }),
      ...(isWalletPay &&
        !hasShares && {
          paymentMethod: 'wallet',
          walletPaidAmount: walletApplied,
          remainderDue: walletRemainderTotal,
          ...(walletRemainderTotal > 0.01 && remainderPm
            ? {
                remainderPaymentMethod: remainderPm,
                ...(remainderPm === 'at_club' ? { initiatorPaymentMethod: 'at_club' } : {}),
              }
            : {}),
        }),
      ...(payAtClubFull && { initiatorPaymentMethod: 'at_club', paymentMethod: 'at_club' }),
      ...(hasShares && initiatorPaymentMethod && { initiatorPaymentMethod }),
    }

    if (isWalletPay && !hasShares && walletApplied > 0) {
      const debit = await walletService.debitWallet(clubId, memberId, walletApplied, { reason: 'court_booking', refType: 'booking', refId: bid })
      if (!debit.ok) {
        return res.status(400).json({ error: debit.error || 'Wallet payment failed' })
      }
      walletRollback = { clubId, memberId, amount: walletApplied, bid }
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
    const confirmNext = addDaysBooking(date, 1)
    if (confirmNext) slotCache.invalidateLocks(clubId, confirmNext)

    const basePath = (process.env.BASE_PATH || '/app').replace(/\/$/, '')
    const ref = req.headers.origin || req.headers.referer || ''
    const origin = ref ? (() => { try { return new URL(ref).origin } catch (_) { return ref.replace(/\/$/, '') } })() : ''
    const baseUrl = process.env.BASE_URL || process.env.PUBLIC_BASE_URL || (origin ? `${origin}${basePath}` : 'https://playtix.app/app')
    const createdShares = []

    const participantsSum = (paymentShares || []).reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0)
    const bookerAmount = Math.max(0, (totalAmount || 0) - participantsSum)
    if (hasShares && bookerAmount > 0) {
      await query(
        `INSERT INTO booking_payment_shares (booking_id, club_id, participant_type, member_id, member_name, amount, payment_method)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [bid, clubId, 'registered', memberId, memberName, bookerAmount, initiatorPaymentMethod || null]
      )
    }
    for (const s of paymentShares || []) {
      const token = `inv_${crypto.randomBytes(16).toString('hex')}`
      const isUnregistered = s.type === 'unregistered'
      const payPath = isUnregistered ? 'pay-invite' : 'pay-share'
      const payUrl = `${baseUrl.replace(/\/$/, '')}/${payPath}/${token}`
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

    const initiatorElectronic = hasShares && (initiatorPaymentMethod === 'credit_card' || initiatorPaymentMethod === 'mada')
    const paymentUrl = isOnlinePayment
      ? `${baseUrl.replace(/\/$/, '')}/pay/${bid}?method=${paymentMethod}`
      : walletHybridOnlineMethod
        ? `${baseUrl.replace(/\/$/, '')}/pay/${bid}?method=${walletHybridOnlineMethod}`
        : initiatorElectronic
          ? `${baseUrl.replace(/\/$/, '')}/pay-share/booking/${bid}?clubId=${clubId}`
          : null

    // Optional: send SMS/WhatsApp confirmation to booker (if phone exists and channel configured)
    try {
      const { rows: memberRows } = await query('SELECT mobile FROM members WHERE id = ? AND deleted_at IS NULL', [memberId])
      const phone = memberRows?.[0]?.mobile
      if (phone) {
        const msg = `تم تأكيد حجزك.\nرقم الحجز: ${bid}\nالتاريخ: ${date}\nالوقت: ${startTime} - ${endTime}`
        const wa = await sendPlatformMessage(phone, msg)
        if (!wa.ok) console.warn('[Bookings] Message send skipped or failed:', wa.error)
      }
    } catch (waErr) {
      console.warn('[Bookings] Message send error:', waErr?.message)
    }

    await issueFullBookingInvoiceIfConfirmedSinglePayer({
      clubId,
      bookingId: bid,
      status,
      totalAmount,
      paidAmount,
      memberId,
      memberName,
      isWalletPay,
      isOnlinePayment,
      paymentMethodRaw: paymentMethod,
    })

    res.json({
      ok: true,
      bookingId: bid,
      status,
      paidAmount,
      paymentShares: createdShares,
      ...(isWalletPay && !hasShares && { walletApplied, remainder: walletRemainderTotal }),
      ...(paymentUrl && { paymentUrl }),
    })
  } catch (e) {
    try {
      if (walletRollback && walletRollback.clubId && walletRollback.memberId && walletRollback.amount > 0) {
        await walletService.creditWallet(walletRollback.clubId, walletRollback.memberId, walletRollback.amount, {
          reason: 'booking_confirm_rollback',
          refType: 'booking',
          refId: walletRollback.bid,
        })
      }
    } catch (_) { /* ignore */ }
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

/** POST /api/bookings/coach-training - Coach creates training slots (multiple dates) */
router.post('/coach-training', async (req, res) => {
  try {
    const normalized = await hasNormalizedTables()
    if (!normalized) return res.status(400).json({ error: 'Normalized tables required' })

    const { clubId, courtId, dates, startTime, endTime, pricePerHour, maxTrainees, coachId } = req.body || {}
    if (!clubId || !courtId || !Array.isArray(dates) || dates.length === 0 || !startTime || !endTime || !coachId) {
      return res.status(400).json({ error: 'clubId, courtId, dates, startTime, endTime, coachId required' })
    }

    let mcRows = []
    try {
      const r = await query(
        'SELECT 1 FROM member_clubs WHERE member_id = ? AND club_id = ? AND is_coach = 1',
        [coachId, clubId]
      )
      mcRows = r.rows || []
    } catch (mcErr) {
      if (mcErr?.message?.includes('is_coach')) {
        return res.status(400).json({ error: 'Coach feature not migrated. Run migrate-booking-v2.' })
      }
      throw mcErr
    }
    if (!mcRows?.length) {
      return res.status(403).json({ error: 'Not a coach for this club' })
    }

    const [sh, sm] = (startTime || '0:0').toString().split(':').map(Number)
    const [eh, em] = (endTime || '0:0').toString().split(':').map(Number)
    const durationHours = ((eh || 0) * 60 + (em || 0) - (sh || 0) * 60 - (sm || 0)) / 60
    const totalAmount = Math.round((parseFloat(pricePerHour) || 0) * Math.max(0.5, durationHours) * 100) / 100
    const maxT = Math.min(4, Math.max(1, parseInt(maxTrainees, 10) || 4))

    const created = []
    for (const dateRaw of dates) {
      const date = (dateRaw || '').toString().replace(/T.*$/, '').trim().substring(0, 10)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue
      if (isBookingInPast(date, startTime)) continue

      const conflict = await lock.hasConflict(clubId, courtId, date, startTime, endTime, null)
      if (conflict) {
        return res.status(409).json({ error: `Slot taken: ${date}`, conflict })
      }

      const bid = `bk_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`
      const dataJson = JSON.stringify({
        type: 'training',
        coachId,
        maxTrainees: maxT,
        pricePerHour: parseFloat(pricePerHour) || 0,
        resource: courtId,
        court: courtId
      })

      await bookingService.createBooking({
        id: bid,
        clubId,
        courtId,
        memberId: coachId,
        date,
        timeSlot: startTime,
        startTime,
        endTime,
        status: 'confirmed',
        totalAmount,
        paidAmount: 0,
        initiatorMemberId: coachId,
        paymentDeadline: null,
        dataJson,
        createdBy: coachId
      })
      created.push({ id: bid, date })
      slotCache.invalidateLocks(clubId, date)
    }

    res.json({ ok: true, created })
  } catch (e) {
    console.error('bookings coach-training error:', e)
    res.status(500).json({ error: dbError(e) })
  }
})

/** POST /api/bookings/join-training - Member joins a coach training slot (adds as trainee/payment share) */
router.post('/join-training', async (req, res) => {
  try {
    const { bookingId, clubId, memberId, memberName, paymentStyle, paymentMethod, paymentShares } = req.body || {}
    if (!bookingId || !clubId || !memberId) {
      return res.status(400).json({ error: 'bookingId, clubId, memberId required' })
    }
    const { rows: bRows } = await query(
      'SELECT id, member_id, total_amount, data, status FROM club_bookings WHERE id = ? AND club_id = ? AND deleted_at IS NULL',
      [bookingId, clubId]
    )
    if (!bRows?.length) return res.status(404).json({ error: 'Training not found' })
    const b = bRows[0]
    let data = {}
    try {
      data = typeof b.data === 'object' ? b.data : JSON.parse(b.data || '{}')
    } catch (_) {}
    if (data.type !== 'training') return res.status(400).json({ error: 'Not a training booking' })
    const coachId = (data.coachId || b.member_id || '').toString()
    if (String(memberId) === coachId) {
      return res.status(403).json({ error: 'Coach cannot join own training' })
    }
    const maxTrainees = Math.min(4, Math.max(1, parseInt(data.maxTrainees, 10) || 4))
    const { rows: shares } = await query(
      'SELECT id, member_id FROM booking_payment_shares WHERE booking_id = ? AND club_id = ?',
      [bookingId, clubId]
    )
    const traineeCount = (shares || []).filter(s => String(s.member_id || '').trim() && String(s.member_id) !== coachId).length
    if (traineeCount >= maxTrainees) {
      return res.status(409).json({ error: 'Training full' })
    }
    const alreadyJoined = (shares || []).some(s => String(s.member_id || '') === String(memberId))
    if (alreadyJoined) return res.status(409).json({ error: 'Already joined' })
    const totalAmount = parseFloat(b.total_amount) || 0
    const payStyle = (paymentStyle || 'at_club').toString().toLowerCase()
    const payMethod = (paymentMethod || 'at_club').toString().toLowerCase()
    const isFull = payStyle === 'full'
    const hasShares = Array.isArray(paymentShares) && paymentShares.length > 0
    const participantsSum = (paymentShares || []).reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0)
    const bookerAmount = hasShares ? Math.max(0, totalAmount - participantsSum) : (isFull ? totalAmount : Math.round((totalAmount / maxTrainees) * 100) / 100)
    if (hasShares && (participantsSum > totalAmount || bookerAmount <= 0)) {
      return res.status(400).json({ error: 'Invalid payment split. Sum must not exceed total.' })
    }
    const effectivePayMethod = payMethod === 'credit_card' || payMethod === 'mada' ? payMethod : 'at_club'
    await query(
      `INSERT INTO booking_payment_shares (booking_id, club_id, participant_type, member_id, member_name, amount, payment_method)
       VALUES (?, ?, 'registered', ?, ?, ?, ?)`,
      [bookingId, clubId, memberId, memberName || null, bookerAmount, effectivePayMethod]
    )
    for (const s of paymentShares || []) {
      const token = `inv_${crypto.randomBytes(16).toString('hex')}`
      const isUnregistered = s.type === 'unregistered'
      const payPath = isUnregistered ? 'pay-invite' : 'pay-share'
      const basePath = (process.env.BASE_PATH || '/app').replace(/\/$/, '')
      const ref = req.headers.origin || req.headers.referer || ''
      const origin = ref ? (() => { try { return new URL(ref).origin } catch (_) { return ref.replace(/\/$/, '') } })() : ''
      const baseUrl = process.env.BASE_URL || process.env.PUBLIC_BASE_URL || (origin ? `${origin}${basePath}` : 'https://playtix.app/app')
      const payUrl = `${baseUrl.replace(/\/$/, '')}/${payPath}/${token}`
      const waLink = (payUrl ? `https://wa.me/?text=${encodeURIComponent(payUrl)}` : null) || s.whatsappLink
      await query(
        `INSERT INTO booking_payment_shares (booking_id, club_id, participant_type, member_id, member_name, phone, amount, whatsapp_link, invite_token)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [bookingId, clubId, s.type || 'registered', s.memberId || null, s.memberName || null, s.phone || null, parseFloat(s.amount) || 0, waLink || null, token]
      )
    }
    const rec = await paymentShareRecalc.recalculateBookingPaymentAfterShareChange(bookingId, clubId)
    const paidAmount = rec?.paidAmount ?? 0
    const status = rec?.status ?? 'pending_payments'
    if (status !== 'confirmed' && !['cancelled', 'cancelled_awaiting_refund_ack', 'expired'].includes(status)) {
      await bookingService.extendPaymentDeadlineAfterShareProgress(bookingId, clubId)
    }
    const settings = await getBookingSettings(clubId)
    const paymentDeadlineMinutes = hasShares ? (settings?.splitPaymentDeadlineMinutes ?? 30) : null
    if (paymentDeadlineMinutes != null) {
      const paymentDeadline = new Date(Date.now() + paymentDeadlineMinutes * 60 * 1000)
      await bookingService.updateBookingPaymentDeadline(bookingId, clubId, paymentDeadline)
    }
    const { rows: dateRow } = await query('SELECT booking_date FROM club_bookings WHERE id = ? AND club_id = ?', [bookingId, clubId])
    const dateStr = dateRow[0]?.booking_date ? String(dateRow[0].booking_date).split('T')[0] : null
    if (clubId && dateStr) slotCache.invalidateLocks(clubId, dateStr)
    const basePath = (process.env.BASE_PATH || '/app').replace(/\/$/, '')
    const ref = req.headers.origin || req.headers.referer || ''
    const origin = ref ? (() => { try { return new URL(ref).origin } catch (_) { return ref.replace(/\/$/, '') } })() : ''
    const baseUrl = process.env.BASE_URL || process.env.PUBLIC_BASE_URL || (origin ? `${origin}${basePath}` : 'https://playtix.app/app')
    const paymentUrl = (effectivePayMethod === 'credit_card' || effectivePayMethod === 'mada')
      ? `${baseUrl.replace(/\/$/, '')}/pay-share/booking/${bookingId}?clubId=${clubId}`
      : null
    res.json({ ok: true, amount: bookerAmount, ...(paymentUrl && { paymentUrl }) })
  } catch (e) {
    console.error('bookings join-training error:', e)
    res.status(500).json({ error: dbError(e) })
  }
})

const shareForInvoiceSql = `
  SELECT bps.id, bps.booking_id, bps.amount, bps.member_id, bps.member_name, bps.phone,
    COALESCE(cs.currency, 'SAR') AS currency
  FROM booking_payment_shares bps
  INNER JOIN club_bookings cb ON cb.id = bps.booking_id AND cb.club_id = bps.club_id AND cb.deleted_at IS NULL
  LEFT JOIN club_settings cs ON cs.club_id = bps.club_id
`

/** POST /api/bookings/record-payment - Record payment for a share (update paid_at, payment_method, recalc status)
 * - paymentMethod 'at_club': commitment only, paid_at = NULL
 * - paymentReference (electronic): actual payment, paid_at = NOW()
 */
router.post('/record-payment', async (req, res) => {
  try {
    const { shareId, inviteToken, clubId, paymentReference, paymentMethod } = req.body || {}
    if (!clubId) return res.status(400).json({ error: 'clubId required' })
    let shareRows
    if (shareId) {
      const r = await query(`${shareForInvoiceSql} WHERE bps.id = ? AND bps.club_id = ?`, [shareId, clubId])
      shareRows = r.rows
    } else if (inviteToken) {
      const r = await query(`${shareForInvoiceSql} WHERE bps.invite_token = ? AND bps.club_id = ?`, [inviteToken, clubId])
      shareRows = r.rows
    } else {
      return res.status(400).json({ error: 'shareId or inviteToken required' })
    }
    if (!shareRows?.length) return res.status(404).json({ error: 'Share not found' })
    const share = shareRows[0]
    async function syncShareDisplayNameFromMember() {
      const mid = share.member_id
      if (!mid) return
      const mr = await query('SELECT name FROM members WHERE id = ? AND deleted_at IS NULL', [String(mid)])
      const n = mr?.rows?.[0]?.name
      if (n && String(n).trim()) {
        await query(
          'UPDATE booking_payment_shares SET member_name = ? WHERE id = ? AND club_id = ?',
          [String(n).trim().substring(0, 255), share.id, clubId]
        )
      }
    }
    const bid = share.booking_id
    const isAtClub = paymentMethod === 'at_club'
    const isElectronic = !!paymentReference
    if (isAtClub) {
      await query(
        'UPDATE booking_payment_shares SET paid_at = NULL, payment_reference = NULL, payment_method = ? WHERE id = ? AND club_id = ?',
        ['at_club', share.id, clubId]
      )
      await syncShareDisplayNameFromMember()
    } else if (isElectronic) {
      await query(
        'UPDATE booking_payment_shares SET paid_at = NOW(), payment_reference = ?, payment_method = ? WHERE id = ? AND club_id = ?',
        [paymentReference || null, 'electronic', share.id, clubId]
      )
      await syncShareDisplayNameFromMember()
    } else {
      await query(
        'UPDATE booking_payment_shares SET paid_at = NOW(), payment_reference = ?, payment_method = ? WHERE id = ? AND club_id = ?',
        [paymentReference || null, null, share.id, clubId]
      )
      await syncShareDisplayNameFromMember()
    }
    const rec = await paymentShareRecalc.recalculateBookingPaymentAfterShareChange(bid, clubId)
    const paidAmount = rec?.paidAmount ?? 0
    const status = rec?.status ?? 'pending_payments'
    if (status !== 'confirmed' && !['cancelled', 'cancelled_awaiting_refund_ack', 'expired'].includes(status)) {
      await bookingService.extendPaymentDeadlineAfterShareProgress(bid, clubId)
    }
    const { rows: bDate } = await query('SELECT booking_date FROM club_bookings WHERE id = ? AND club_id = ?', [bid, clubId])
    const dateStr = bDate[0]?.booking_date ? String(bDate[0].booking_date).split('T')[0] : null
    if (clubId && dateStr) slotCache.invalidateLocks(clubId, dateStr)
    if (!isAtClub) {
      try {
        await invoiceService.issueInvoiceForPaidShare({
          clubId,
          bookingId: bid,
          shareId: share.id,
          amount: share.amount,
          currency: share.currency,
          memberId: share.member_id,
          memberName: share.member_name,
          phone: share.phone,
          paymentMethod: isElectronic ? 'electronic' : 'other',
          paymentReference: paymentReference || null,
        })
      } catch (invErr) {
        console.warn('[record-payment] invoice:', invErr?.message)
      }
    }
    res.json({ ok: true, paidAmount, status })
  } catch (e) {
    console.error('bookings record-payment error:', e)
    res.status(500).json({ error: dbError(e) })
  }
})

/** POST /api/bookings/mark-share-paid-at-club - Admin marks a participant share as paid when cash received at club */
router.post('/mark-share-paid-at-club', async (req, res) => {
  try {
    const { shareId, inviteToken, clubId } = req.body || {}
    if (!clubId) return res.status(400).json({ error: 'clubId required' })
    let shareRows
    if (shareId) {
      const r = await query(`${shareForInvoiceSql} WHERE bps.id = ? AND bps.club_id = ?`, [shareId, clubId])
      shareRows = r.rows
    } else if (inviteToken) {
      const r = await query(`${shareForInvoiceSql} WHERE bps.invite_token = ? AND bps.club_id = ?`, [inviteToken, clubId])
      shareRows = r.rows
    } else {
      return res.status(400).json({ error: 'shareId or inviteToken required' })
    }
    if (!shareRows?.length) return res.status(404).json({ error: 'Share not found' })
    const share = shareRows[0]
    const bid = share.booking_id
    await query(
      'UPDATE booking_payment_shares SET paid_at = NOW(), payment_method = ? WHERE id = ? AND club_id = ?',
      ['at_club', share.id, clubId]
    )
    if (share.member_id) {
      const mr = await query('SELECT name FROM members WHERE id = ? AND deleted_at IS NULL', [String(share.member_id)])
      const n = mr?.rows?.[0]?.name
      if (n && String(n).trim()) {
        await query(
          'UPDATE booking_payment_shares SET member_name = ? WHERE id = ? AND club_id = ?',
          [String(n).trim().substring(0, 255), share.id, clubId]
        )
      }
    }
    const rec = await paymentShareRecalc.recalculateBookingPaymentAfterShareChange(bid, clubId)
    const paidAmount = rec?.paidAmount ?? 0
    const status = rec?.status ?? 'pending_payments'
    if (status !== 'confirmed' && !['cancelled', 'cancelled_awaiting_refund_ack', 'expired'].includes(status)) {
      await bookingService.extendPaymentDeadlineAfterShareProgress(bid, clubId)
    }
    const { rows: bDate } = await query('SELECT booking_date FROM club_bookings WHERE id = ? AND club_id = ?', [bid, clubId])
    const dateStr = bDate[0]?.booking_date ? String(bDate[0].booking_date).split('T')[0] : null
    if (clubId && dateStr) slotCache.invalidateLocks(clubId, dateStr)
    try {
      await invoiceService.issueInvoiceForPaidShare({
        clubId,
        bookingId: bid,
        shareId: share.id,
        amount: share.amount,
        currency: share.currency,
        memberId: share.member_id,
        memberName: share.member_name,
        phone: share.phone,
        paymentMethod: 'at_club',
        paymentReference: null,
      })
    } catch (invErr) {
      console.warn('[mark-share-paid-at-club] invoice:', invErr?.message)
    }
    res.json({ ok: true, paidAmount, status })
  } catch (e) {
    console.error('bookings mark-share-paid-at-club error:', e)
    res.status(500).json({ error: dbError(e) })
  }
})

/** PATCH /api/bookings/update-share-payment-method - Participant switches payment method (at_club <-> electronic) before paying */
router.patch('/update-share-payment-method', async (req, res) => {
  try {
    const { inviteToken, clubId, paymentMethod } = req.body || {}
    if (!inviteToken || !clubId || !paymentMethod) return res.status(400).json({ error: 'inviteToken, clubId, paymentMethod required' })
    const pm = paymentMethod === 'at_club' ? 'at_club' : (paymentMethod === 'electronic' ? 'electronic' : null)
    if (!pm) return res.status(400).json({ error: 'paymentMethod must be at_club or electronic' })
    const { rows } = await query(
      'SELECT id FROM booking_payment_shares WHERE invite_token = ? AND club_id = ? AND paid_at IS NULL',
      [inviteToken, clubId]
    )
    if (!rows?.length) return res.status(404).json({ error: 'Share not found or already paid' })
    await query(
      'UPDATE booking_payment_shares SET payment_method = ? WHERE id = ? AND club_id = ?',
      [pm, rows[0].id, clubId]
    )
    res.json({ ok: true, paymentMethod: pm })
  } catch (e) {
    console.error('bookings update-share-payment-method error:', e)
    res.status(500).json({ error: dbError(e) })
  }
})

/** POST /api/bookings/mark-pay-at-club - Extend deadline; store initiatorPaymentMethod in data for display */
router.post('/mark-pay-at-club', async (req, res) => {
  try {
    const normalized = await hasNormalizedTables()
    if (!normalized) return res.status(400).json({ error: 'Normalized tables required' })
    const { bookingId, clubId } = req.body || {}
    if (!bookingId || !clubId) return res.status(400).json({ error: 'bookingId and clubId required' })
    const { rows } = await query(
      'SELECT id, booking_date, status, data FROM club_bookings WHERE id = ? AND club_id = ? AND deleted_at IS NULL',
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
    let data = b.data
    if (typeof data === 'string') { try { data = JSON.parse(data) } catch { data = {} } }
    if (data && typeof data === 'object' && !data.initiatorPaymentMethod) {
      data = { ...data, initiatorPaymentMethod: 'at_club' }
      await query('UPDATE club_bookings SET data = ? WHERE id = ? AND club_id = ?', [JSON.stringify(data), bookingId, clubId])
    }
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

/** POST /api/bookings/coach-training-invite — Coach records invites + optional WhatsApp prep (member sees in My bookings) */
router.post('/coach-training-invite', async (req, res) => {
  try {
    const normalized = await hasNormalizedTables()
    if (!normalized) return res.status(400).json({ error: 'Normalized tables required' })

    const { clubId, bookingId, coachId, memberIds } = req.body || {}
    if (!clubId || !bookingId || !coachId || !Array.isArray(memberIds) || memberIds.length === 0) {
      return res.status(400).json({ error: 'clubId, bookingId, coachId, memberIds required' })
    }

    let mcRows = []
    try {
      const r = await query(
        'SELECT 1 FROM member_clubs WHERE member_id = ? AND club_id = ? AND is_coach = 1',
        [coachId, clubId]
      )
      mcRows = r.rows || []
    } catch (mcErr) {
      if (mcErr?.message?.includes('is_coach')) {
        return res.status(400).json({ error: 'Coach feature not migrated.' })
      }
      throw mcErr
    }
    if (!mcRows?.length) {
      return res.status(403).json({ error: 'Not a coach for this club' })
    }

    const { rows: bRows } = await query(
      'SELECT id, member_id, data FROM club_bookings WHERE id = ? AND club_id = ? AND deleted_at IS NULL',
      [bookingId, clubId]
    )
    if (!bRows?.length) return res.status(404).json({ error: 'Booking not found' })
    let data = {}
    try {
      data = typeof bRows[0].data === 'object' ? bRows[0].data : JSON.parse(bRows[0].data || '{}')
    } catch (_) {}
    if (data.type !== 'training') return res.status(400).json({ error: 'Not a training booking' })
    const dataCoach = (data.coachId || bRows[0].member_id || '').toString()
    if (String(dataCoach) !== String(coachId)) {
      return res.status(403).json({ error: 'Not your training slot' })
    }

    const uniqueInvitees = [...new Set(memberIds.map((id) => String(id).trim()).filter(Boolean))]
      .filter((id) => id !== String(coachId))
    if (uniqueInvitees.length === 0) {
      return res.status(400).json({ error: 'No valid invitees' })
    }

    let tableMissing = false
    for (const inviteeId of uniqueInvitees) {
      try {
        await query(
          `INSERT IGNORE INTO coach_training_invites (club_id, booking_id, coach_member_id, invitee_member_id)
           VALUES (?, ?, ?, ?)`,
          [clubId, bookingId, coachId, inviteeId]
        )
      } catch (insErr) {
        if (insErr?.message?.includes("doesn't exist") || insErr?.code === 'ER_NO_SUCH_TABLE') {
          tableMissing = true
          break
        }
        throw insErr
      }
    }
    if (tableMissing) {
      return res.status(503).json({ error: 'coach_training_invites table missing. Run DB migration.' })
    }

    res.json({ ok: true, recorded: uniqueInvitees.length })
  } catch (e) {
    console.error('bookings coach-training-invite error:', e)
    res.status(500).json({ error: dbError(e) })
  }
})

/** GET /api/bookings/my-training-invites — Pending training session invites for a member */
router.get('/my-training-invites', async (req, res) => {
  try {
    const { memberId } = req.query
    if (!memberId) return res.status(400).json({ error: 'memberId required' })
    try {
      const { rows } = await query(
        `SELECT i.id, i.booking_id, i.club_id, i.coach_member_id, i.created_at,
                b.booking_date AS booking_date, b.start_time, b.end_time, b.court_id
         FROM coach_training_invites i
         INNER JOIN club_bookings b ON b.id = i.booking_id AND b.club_id = i.club_id AND b.deleted_at IS NULL
         WHERE i.invitee_member_id = ? AND i.dismissed_at IS NULL
         ORDER BY i.created_at DESC`,
        [memberId]
      )
      const out = (rows || []).map((r) => ({
        id: r.id,
        bookingId: r.booking_id,
        clubId: r.club_id,
        coachMemberId: r.coach_member_id,
        createdAt: r.created_at,
        date: r.booking_date ? String(r.booking_date).split('T')[0] : null,
        startTime: r.start_time || null,
        endTime: r.end_time || null,
        courtId: r.court_id || null
      }))
      res.json(out)
    } catch (e) {
      if (e?.message?.includes("doesn't exist") || e?.code === 'ER_NO_SUCH_TABLE') {
        return res.json([])
      }
      throw e
    }
  } catch (e) {
    console.error('bookings my-training-invites error:', e)
    res.status(500).json({ error: dbError(e) })
  }
})

/** POST /api/bookings/dismiss-training-invite */
router.post('/dismiss-training-invite', async (req, res) => {
  try {
    const { inviteId, memberId } = req.body || {}
    if (!inviteId || !memberId) {
      return res.status(400).json({ error: 'inviteId, memberId required' })
    }
    try {
      await query(
        'UPDATE coach_training_invites SET dismissed_at = NOW() WHERE id = ? AND invitee_member_id = ?',
        [inviteId, memberId]
      )
    } catch (e) {
      if (e?.message?.includes("doesn't exist") || e?.code === 'ER_NO_SUCH_TABLE') {
        return res.json({ ok: true })
      }
      throw e
    }
    res.json({ ok: true })
  } catch (e) {
    console.error('bookings dismiss-training-invite error:', e)
    res.status(500).json({ error: dbError(e) })
  }
})

/** GET /api/bookings/share-invite - Get invite token for member's pending share (for participant payment flow) */
router.get('/share-invite', async (req, res) => {
  try {
    const { bookingId, clubId, memberId } = req.query
    if (!bookingId || !clubId || !memberId) {
      return res.status(400).json({ error: 'bookingId, clubId, memberId required' })
    }
    let rows
    try {
      const r = await query(
        `SELECT id, invite_token FROM booking_payment_shares 
         WHERE booking_id = ? AND club_id = ? AND member_id = ? AND paid_at IS NULL AND removed_at IS NULL`,
        [bookingId, clubId, memberId]
      )
      rows = r.rows
    } catch (_) {
      const r = await query(
        `SELECT id, invite_token FROM booking_payment_shares 
         WHERE booking_id = ? AND club_id = ? AND member_id = ? AND paid_at IS NULL`,
        [bookingId, clubId, memberId]
      )
      rows = r.rows
    }
    if (!rows?.length) {
      return res.status(404).json({ error: 'Share not found or already paid' })
    }
    let token = rows[0].invite_token
    // Backfill: if token was null (legacy registered shares), generate and persist one
    if (!token) {
      token = `inv_${crypto.randomBytes(16).toString('hex')}`
      await query(
        `UPDATE booking_payment_shares SET invite_token = ? WHERE id = ?`,
        [token, rows[0].id]
      )
    }
    res.json({ inviteToken: token })
  } catch (e) {
    console.error('bookings share-invite error:', e)
    res.status(500).json({ error: dbError(e) })
  }
})

/** POST /api/bookings/claim-invite-share - After quick register: attach member_id to unregistered share so My Bookings lists the booking */
router.post('/claim-invite-share', async (req, res) => {
  try {
    const normalized = await hasNormalizedTables()
    if (!normalized) return res.status(400).json({ error: 'Normalized tables required' })
    const body = req.body || {}
    const inviteToken = normalizeInviteTokenParamExpress(body.inviteToken)
    const { clubId, memberId, phone, memberName } = body
    if (!inviteToken || !clubId || !memberId) {
      return res.status(400).json({ error: 'inviteToken, clubId, memberId required' })
    }
    const pd = (s) => (s || '').replace(/\D/g, '')
    const tailKey = (d) => (d.length >= 9 ? d.slice(-9) : d)
    let rows
    try {
      const r = await query(
        `SELECT id, phone, member_id, booking_id, removed_at FROM booking_payment_shares WHERE invite_token = ? AND club_id = ?`,
        [inviteToken, clubId]
      )
      rows = r.rows
    } catch (_) {
      const r = await query(
        `SELECT id, phone, member_id, booking_id FROM booking_payment_shares WHERE invite_token = ? AND club_id = ?`,
        [inviteToken, clubId]
      )
      rows = r.rows
    }
    if (!rows?.length) return res.status(404).json({ error: 'Share not found' })
    const row = rows[0]
    if (row.removed_at) return res.status(410).json({ error: 'Invite is no longer valid' })
    if (row.member_id != null && String(row.member_id).trim() !== '' && String(row.member_id) !== String(memberId)) {
      return res.status(409).json({ error: 'Share already linked to another account' })
    }
    const rowPhone = pd(row.phone || '')
    const userPhone = pd(phone || '')
    if (rowPhone && userPhone && tailKey(rowPhone) !== tailKey(userPhone)) {
      return res.status(403).json({ error: 'Phone does not match invite' })
    }
    let displayName =
      (memberName && String(memberName).trim()) ? String(memberName).trim().substring(0, 255) : null
    if (!displayName) {
      const mr = await query('SELECT name FROM members WHERE id = ? AND deleted_at IS NULL', [String(memberId)])
      const n = mr?.rows?.[0]?.name
      if (n && String(n).trim()) displayName = String(n).trim().substring(0, 255)
    }
    if (displayName) {
      await query(
        `UPDATE booking_payment_shares SET member_id = ?, participant_type = 'registered', member_name = ? WHERE id = ? AND club_id = ?`,
        [String(memberId), displayName, row.id, clubId]
      )
    } else {
      await query(
        `UPDATE booking_payment_shares SET member_id = ?, participant_type = 'registered' WHERE id = ? AND club_id = ?`,
        [String(memberId), row.id, clubId]
      )
    }
    res.json({ ok: true, bookingId: row.booking_id })
  } catch (e) {
    console.error('bookings claim-invite-share error:', e)
    res.status(500).json({ error: dbError(e) })
  }
})

async function mergeClubBookingDataJson(bookingId, clubId, patch) {
  const { rows } = await query('SELECT data FROM club_bookings WHERE id = ? AND club_id = ? AND deleted_at IS NULL', [bookingId, clubId])
  if (!rows?.length) return false
  let data = {}
  try {
    data = typeof rows[0].data === 'object' ? rows[0].data : JSON.parse(rows[0].data || '{}')
  } catch (_) {
    data = {}
  }
  await query('UPDATE club_bookings SET data = ? WHERE id = ? AND club_id = ?', [
    JSON.stringify({ ...data, ...patch }),
    bookingId,
    clubId
  ])
  return true
}

/** POST /api/bookings/admin-refund-share — استرداد حصة (نقد/إلكتروني يدوي) واختيارياً إزالة المشارك */
router.post('/admin-refund-share', async (req, res) => {
  try {
    const {
      shareId,
      inviteToken,
      clubId,
      refundMethod,
      refundReference,
      refundNotes,
      removeFromBooking
    } = req.body || {}
    if (!clubId) return res.status(400).json({ error: 'clubId required' })
    const allowedMethods = new Set(['cash', 'pos', 'stripe_manual', 'electronic_reverse', 'other'])
    const rm = allowedMethods.has((refundMethod || '').toString()) ? refundMethod : 'other'
    let shareRows
    async function loadShare(whereSql, params) {
      try {
        const r = await query(
          `SELECT id, booking_id, paid_at, refunded_at, removed_at FROM booking_payment_shares WHERE ${whereSql}`,
          params
        )
        return r.rows
      } catch (_) {
        const r = await query(
          `SELECT id, booking_id, paid_at, refunded_at FROM booking_payment_shares WHERE ${whereSql}`,
          params
        )
        return (r.rows || []).map((x) => ({ ...x, removed_at: null }))
      }
    }
    if (shareId) {
      shareRows = await loadShare('id = ? AND club_id = ?', [shareId, clubId])
    } else if (inviteToken) {
      shareRows = await loadShare('invite_token = ? AND club_id = ?', [inviteToken, clubId])
    } else {
      return res.status(400).json({ error: 'shareId or inviteToken required' })
    }
    if (!shareRows?.length) return res.status(404).json({ error: 'Share not found' })
    const row = shareRows[0]
    if (row.removed_at) return res.status(400).json({ error: 'Share already removed' })
    if (row.refunded_at) return res.status(400).json({ error: 'Already refunded' })
    if (!row.paid_at) {
      return res.status(400).json({ error: 'Nothing to refund — share was not paid' })
    }
    const bid = row.booking_id
    try {
      await query(
        `UPDATE booking_payment_shares SET refunded_at = NOW(), refund_method = ?, refund_reference = ?, refund_notes = ? WHERE id = ? AND club_id = ?`,
        [rm, refundReference || null, (refundNotes || '').toString().substring(0, 500) || null, row.id, clubId]
      )
    } catch (e) {
      if (!e?.message?.includes('refunded_at') && !e?.message?.includes('refund_method')) throw e
      return res.status(503).json({ error: 'Run DB migration add-booking-refund-columns.sql' })
    }
    if (removeFromBooking) {
      try {
        await query(`UPDATE booking_payment_shares SET removed_at = NOW() WHERE id = ? AND club_id = ?`, [row.id, clubId])
      } catch (e) {
        if (!e?.message?.includes('removed_at')) throw e
      }
      await mergeClubBookingDataJson(bid, clubId, { splitInviteReopen: true })
    }
    const rec = await paymentShareRecalc.recalculateBookingPaymentAfterShareChange(bid, clubId)
    if (clubId && rec?.bookingDate) slotCache.invalidateLocks(clubId, rec.bookingDate)
    res.json({ ok: true, ...rec })
  } catch (e) {
    console.error('bookings admin-refund-share error:', e)
    res.status(500).json({ error: dbError(e) })
  }
})

/** POST /api/bookings/admin-refund-booking-full — استرداد كل من دفع + إلغاء الحجز بانتظار تأكيد المستردين */
router.post('/admin-refund-booking-full', async (req, res) => {
  try {
    const { bookingId, clubId, refundMethod, refundReference, refundNotes } = req.body || {}
    if (!bookingId || !clubId) return res.status(400).json({ error: 'bookingId and clubId required' })
    const allowedMethods = new Set(['cash', 'pos', 'stripe_manual', 'electronic_reverse', 'other'])
    const rm = allowedMethods.has((refundMethod || '').toString()) ? refundMethod : 'other'
    const { rows: shares } = await query(
      `SELECT id, paid_at, refunded_at, removed_at FROM booking_payment_shares WHERE booking_id = ? AND club_id = ?`,
      [bookingId, clubId]
    )
    if (!shares?.length) {
      return res.status(400).json({ error: 'No payment shares for this booking' })
    }
    const note = (refundNotes || '').toString().substring(0, 500) || null
    const ref = refundReference || null
    for (const s of shares) {
      if (s.removed_at) continue
      if (s.refunded_at) continue
      if (s.paid_at) {
        try {
          await query(
            `UPDATE booking_payment_shares SET refunded_at = NOW(), refund_method = ?, refund_reference = ?, refund_notes = ? WHERE id = ? AND club_id = ?`,
            [rm, ref, note, s.id, clubId]
          )
        } catch (e) {
          if (!e?.message?.includes('refunded_at')) throw e
          return res.status(503).json({ error: 'Run DB migration add-booking-refund-columns.sql' })
        }
      } else {
        try {
          await query(`UPDATE booking_payment_shares SET removed_at = NOW() WHERE id = ? AND club_id = ?`, [s.id, clubId])
        } catch (e) {
          if (!e?.message?.includes('removed_at')) throw e
        }
      }
    }
    await mergeClubBookingDataJson(bookingId, clubId, { splitInviteReopen: true })
    const rec = await paymentShareRecalc.recalculateBookingPaymentAfterShareChange(bookingId, clubId, {
      forceStatus: 'cancelled_awaiting_refund_ack'
    })
    if (clubId && rec?.bookingDate) slotCache.invalidateLocks(clubId, rec.bookingDate)
    res.json({ ok: true, ...rec })
  } catch (e) {
    console.error('bookings admin-refund-booking-full error:', e)
    res.status(500).json({ error: dbError(e) })
  }
})

/** POST /api/bookings/acknowledge-share-refund — المشارك يؤكد استلام الاسترداد */
router.post('/acknowledge-share-refund', async (req, res) => {
  try {
    const { shareId, inviteToken, clubId, memberId, phone } = req.body || {}
    if (!clubId || !memberId) return res.status(400).json({ error: 'clubId and memberId required' })
    let shareRows
    if (shareId) {
      const r = await query(
        'SELECT id, booking_id, member_id, phone, refunded_at, refund_acknowledged_at FROM booking_payment_shares WHERE id = ? AND club_id = ?',
        [shareId, clubId]
      )
      shareRows = r.rows
    } else if (inviteToken) {
      const r = await query(
        'SELECT id, booking_id, member_id, phone, refunded_at, refund_acknowledged_at FROM booking_payment_shares WHERE invite_token = ? AND club_id = ?',
        [inviteToken, clubId]
      )
      shareRows = r.rows
    } else {
      return res.status(400).json({ error: 'shareId or inviteToken required' })
    }
    if (!shareRows?.length) return res.status(404).json({ error: 'Share not found' })
    const row = shareRows[0]
    const mid = String(memberId)
    if (row.member_id != null && String(row.member_id) !== mid) {
      return res.status(403).json({ error: 'Not your share' })
    }
    const pd = (s) => (s || '').replace(/\D/g, '')
    const tail = (d) => (d.length >= 9 ? d.slice(-9) : d)
    if (!row.member_id || String(row.member_id).trim() === '') {
      const rp = pd(row.phone || '')
      const up = pd(phone || '')
      if (!rp || !up || tail(rp) !== tail(up)) return res.status(403).json({ error: 'Phone does not match share' })
    }
    if (!row.refunded_at) return res.status(400).json({ error: 'Refund not recorded yet' })
    if (row.refund_acknowledged_at) return res.json({ ok: true, alreadyAcknowledged: true })
    try {
      await query(
        `UPDATE booking_payment_shares SET refund_acknowledged_at = NOW() WHERE id = ? AND club_id = ?`,
        [row.id, clubId]
      )
    } catch (e) {
      if (!e?.message?.includes('refund_acknowledged_at')) throw e
      return res.status(503).json({ error: 'Run DB migration add-booking-refund-columns.sql' })
    }
    const rec = await paymentShareRecalc.recalculateBookingPaymentAfterShareChange(row.booking_id, clubId)
    if (clubId && rec?.bookingDate) slotCache.invalidateLocks(clubId, rec.bookingDate)
    res.json({ ok: true, ...rec })
  } catch (e) {
    console.error('bookings acknowledge-share-refund error:', e)
    res.status(500).json({ error: dbError(e) })
  }
})

/** POST /api/bookings/admin-extend-split-deadline — بعد تعديل الحجز من لوحة الإدارة: إعادة مهلة الدفع حسب split_payment_deadline_minutes */
router.post('/admin-extend-split-deadline', async (req, res) => {
  try {
    const normalized = await hasNormalizedTables()
    if (!normalized) return res.status(400).json({ error: 'Normalized tables required' })
    const { bookingId, clubId } = req.body || {}
    if (!bookingId || !clubId) return res.status(400).json({ error: 'bookingId and clubId required' })
    const { rows } = await query(
      `SELECT status FROM club_bookings WHERE id = ? AND club_id = ? AND deleted_at IS NULL`,
      [bookingId, clubId]
    )
    if (!rows?.length) return res.status(404).json({ error: 'Booking not found' })
    const st = (rows[0].status || '').toString()
    const awaiting = ['initiated', 'locked', 'pending_payments', 'pending_payment', 'partially_paid']
    if (!awaiting.includes(st)) {
      return res.json({ ok: true, skipped: true })
    }
    const deadline = await bookingService.extendPaymentDeadlineAfterShareProgress(bookingId, clubId)
    const { rows: dr } = await query('SELECT booking_date FROM club_bookings WHERE id = ? AND club_id = ?', [bookingId, clubId])
    const dateStr = bookingService.normalizeBookingDateYmd(dr[0]?.booking_date)
    if (clubId && dateStr) slotCache.invalidateLocks(clubId, dateStr)
    res.json({ ok: true, paymentDeadlineAt: deadline?.toISOString?.() ?? null })
  } catch (e) {
    console.error('bookings admin-extend-split-deadline error:', e)
    res.status(500).json({ error: dbError(e) })
  }
})

/** POST /api/bookings/add-split-participants — الحاجز يضيف مشاركين بعد فتح إعادة الدعوة */
router.post('/add-split-participants', async (req, res) => {
  try {
    const { bookingId, clubId, memberId, paymentShares } = req.body || {}
    if (!bookingId || !clubId || !memberId) {
      return res.status(400).json({ error: 'bookingId, clubId, memberId required' })
    }
    if (!Array.isArray(paymentShares) || paymentShares.length === 0) {
      return res.status(400).json({ error: 'paymentShares array required' })
    }
    const { rows: bRows } = await query(
      `SELECT id, member_id, initiator_member_id, total_amount, status, data FROM club_bookings WHERE id = ? AND club_id = ? AND deleted_at IS NULL`,
      [bookingId, clubId]
    )
    if (!bRows?.length) return res.status(404).json({ error: 'Booking not found' })
    const b = bRows[0]
    const initiator = String(b.initiator_member_id || b.member_id || '')
    if (String(memberId) !== initiator) return res.status(403).json({ error: 'Only booker can add participants' })
    const st = (b.status || '').toString()
    if (['cancelled', 'expired', 'cancelled_awaiting_refund_ack'].includes(st)) {
      return res.status(400).json({ error: 'Cannot modify this booking' })
    }
    let data = {}
    try {
      data = typeof b.data === 'object' ? b.data : JSON.parse(b.data || '{}')
    } catch (_) {}
    let removedCountRes
    try {
      removedCountRes = await query(
        `SELECT COUNT(*) AS c FROM booking_payment_shares WHERE booking_id = ? AND club_id = ? AND removed_at IS NOT NULL`,
        [bookingId, clubId]
      )
    } catch (_) {
      removedCountRes = { rows: [{ c: 0 }] }
    }
    const hasRemoved = Number(removedCountRes?.rows?.[0]?.c || 0) > 0
    if (!hasRemoved && !data.splitInviteReopen) {
      return res.status(400).json({ error: 'Adding participants is not open for this booking yet' })
    }
    const totalAmount = parseFloat(b.total_amount) || 0
    let activeSumRes
    try {
      activeSumRes = await query(
        `SELECT COALESCE(SUM(amount), 0) AS s FROM booking_payment_shares WHERE booking_id = ? AND club_id = ? AND (removed_at IS NULL)`,
        [bookingId, clubId]
      )
    } catch (_) {
      activeSumRes = await query(
        `SELECT COALESCE(SUM(amount), 0) AS s FROM booking_payment_shares WHERE booking_id = ? AND club_id = ?`,
        [bookingId, clubId]
      )
    }
    const activeSum = parseFloat(activeSumRes?.rows?.[0]?.s) || 0
    const newSum = paymentShares.reduce((acc, s) => acc + (parseFloat(s.amount) || 0), 0)
    if (activeSum + newSum > totalAmount + 0.02) {
      return res.status(400).json({ error: 'Total split exceeds booking amount' })
    }
    const basePath = (process.env.BASE_PATH || '/app').replace(/\/$/, '')
    const ref = req.headers.origin || req.headers.referer || ''
    const origin = ref ? (() => { try { return new URL(ref).origin } catch (_) { return ref.replace(/\/$/, '') } })() : ''
    const baseUrl = process.env.BASE_URL || process.env.PUBLIC_BASE_URL || (origin ? `${origin}${basePath}` : 'https://playtix.app/app')
    const created = []
    for (const s of paymentShares) {
      const token = `inv_${crypto.randomBytes(16).toString('hex')}`
      const isUnregistered = s.type === 'unregistered'
      const payPath = isUnregistered ? 'pay-invite' : 'pay-share'
      const payUrl = `${baseUrl.replace(/\/$/, '')}/${payPath}/${token}`
      const waLink = (payUrl ? `https://wa.me/?text=${encodeURIComponent(payUrl)}` : null) || s.whatsappLink
      await query(
        `INSERT INTO booking_payment_shares (booking_id, club_id, participant_type, member_id, member_name, phone, amount, whatsapp_link, invite_token)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          bookingId,
          clubId,
          s.type || 'registered',
          s.memberId || null,
          s.memberName || null,
          s.phone || null,
          parseFloat(s.amount) || 0,
          waLink || null,
          token
        ]
      )
      created.push({ ...s, inviteToken: token, payInviteUrl: payUrl })
    }
    const rec = await paymentShareRecalc.recalculateBookingPaymentAfterShareChange(bookingId, clubId)
    if (clubId && rec?.bookingDate) slotCache.invalidateLocks(clubId, rec.bookingDate)
    res.json({ ok: true, paymentShares: created, ...rec })
  } catch (e) {
    console.error('bookings add-split-participants error:', e)
    res.status(500).json({ error: dbError(e) })
  }
})

/** GET /api/bookings/invite/:token - Get invite/share data by token (must be before /:id) */
router.get('/invite/:token', async (req, res) => {
  try {
    const token = normalizeInviteTokenParamExpress(req.params.token)
    if (!token) return res.status(400).json({ error: 'Token required' })
    let rows
    const innerJoinSql = (removedFilter) =>
      `SELECT bps.id, bps.booking_id, bps.club_id, bps.participant_type, bps.member_id, bps.member_name, bps.phone, bps.amount, bps.invite_token, bps.paid_at, bps.payment_method,
              bps.removed_at, bps.refunded_at,
              cb.court_id, cb.booking_date, cb.start_time, cb.end_time, cb.status AS booking_status, cb.total_amount
       FROM booking_payment_shares bps
       JOIN club_bookings cb ON cb.id = bps.booking_id AND cb.club_id = bps.club_id AND cb.deleted_at IS NULL
       WHERE bps.invite_token = ?${removedFilter}`
    let q = await query(innerJoinSql(' AND (bps.removed_at IS NULL)'), [token])
    rows = q.rows
    if (!rows?.length) {
      q = await query(innerJoinSql(''), [token])
      rows = q.rows
    }
    if (!rows?.length) {
      let bpsOnly
      try {
        const r = await query(
          `SELECT id, booking_id, club_id, participant_type, member_id, member_name, phone, amount, invite_token, paid_at, payment_method, removed_at, refunded_at
           FROM booking_payment_shares WHERE invite_token = ? LIMIT 1`,
          [token]
        )
        bpsOnly = r.rows?.[0]
      } catch (_) {
        bpsOnly = null
      }
      if (!bpsOnly) return res.status(404).json({ error: 'Invite not found' })
      let cb
      try {
        const r2 = await query(
          `SELECT court_id, booking_date, start_time, end_time, status AS booking_status, total_amount
           FROM club_bookings WHERE id = ? AND club_id = ? AND deleted_at IS NULL LIMIT 1`,
          [bpsOnly.booking_id, bpsOnly.club_id]
        )
        cb = r2.rows?.[0]
      } catch (_) {
        cb = null
      }
      if (!cb) return res.status(410).json({ error: 'Booking no longer available for this invite' })
      const r = { ...bpsOnly, ...cb }
      if (r.removed_at) return res.status(410).json({ error: 'Invite is no longer valid' })
      return res.json({
        inviteToken: r.invite_token,
        bookingId: r.booking_id,
        clubId: r.club_id,
        participantType: r.participant_type,
        memberId: r.member_id,
        memberName: r.member_name,
        phone: r.phone,
        amount: parseFloat(r.amount) || 0,
        paidAt: r.paid_at || undefined,
        paymentMethod: r.payment_method || undefined,
        courtId: r.court_id,
        bookingDate: r.booking_date ? String(r.booking_date).split('T')[0] : null,
        startTime: r.start_time,
        endTime: r.end_time,
        bookingStatus: r.booking_status,
        totalAmount: parseFloat(r.total_amount) || 0
      })
    }
    const r = rows[0]
    if (r.removed_at) return res.status(410).json({ error: 'Invite is no longer valid' })
    res.json({
      inviteToken: r.invite_token,
      bookingId: r.booking_id,
      clubId: r.club_id,
      participantType: r.participant_type,
      memberId: r.member_id,
      memberName: r.member_name,
      phone: r.phone,
      amount: parseFloat(r.amount) || 0,
      paidAt: r.paid_at || undefined,
      paymentMethod: r.payment_method || undefined,
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

/** GET /api/bookings/wallet-balance?clubId=&memberId= — MUST register before /:id or Express treats path as booking id */
router.get('/wallet-balance', async (req, res) => {
  try {
    const { clubId, memberId } = req.query
    if (!clubId || !memberId) return res.status(400).json({ error: 'clubId and memberId required' })
    const { balance, repaired } = await walletService.getWalletBalanceWithRepair(clubId, memberId)
    res.json({ ok: true, balance, repaired })
  } catch (e) {
    res.status(500).json({ error: dbError(e) })
  }
})

/**
 * GET /api/bookings/wallet — alias for wallet-balance (older clients / minified paths).
 * Query: clubId & memberId (or club_id / member_id). Optional: rid or cid as clubId alias.
 */
router.get('/wallet', async (req, res) => {
  try {
    const clubId = req.query.clubId || req.query.club_id || req.query.cid || req.query.rid
    const memberId = req.query.memberId || req.query.member_id || req.query.mid
    if (!clubId || !memberId) return res.status(400).json({ error: 'clubId and memberId required' })
    const { balance, repaired } = await walletService.getWalletBalanceWithRepair(clubId, memberId)
    res.json({ ok: true, balance, repaired })
  } catch (e) {
    res.status(500).json({ error: dbError(e) })
  }
})

/** GET /api/bookings/:id - Get booking by ID (for payment page) */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params
    if (!id) return res.status(400).json({ error: 'Booking ID required' })
    const { rows } = await query(
      `SELECT cb.id, cb.club_id, cb.court_id, cb.member_id, cb.booking_date, cb.time_slot, cb.start_time, cb.end_time, cb.status, cb.total_amount, cb.paid_amount, cb.data,
              c.name AS club_name, c.name_ar AS club_name_ar,
              cs.currency
       FROM club_bookings cb
       LEFT JOIN clubs c ON c.id = cb.club_id AND c.deleted_at IS NULL
       LEFT JOIN club_settings cs ON cs.club_id = cb.club_id
       WHERE cb.id = ? AND cb.deleted_at IS NULL`,
      [id]
    )
    if (!rows?.length) return res.status(404).json({ error: 'Booking not found' })
    const r = rows[0]
    let data = r.data
    if (typeof data === 'string') {
      try { data = JSON.parse(data) } catch { data = {} }
    }
    const dateStr = r.booking_date ? String(r.booking_date).split('T')[0] : null
    const totalAmt = parseFloat(r.total_amount) || 0
    const paidAmt = parseFloat(r.paid_amount) || 0
    const amountDue = Math.max(0, Math.round((totalAmt - paidAmt) * 100) / 100)
    const remPm = (data && data.remainderPaymentMethod) ? String(data.remainderPaymentMethod).toLowerCase().trim() : ''
    let paymentMethodOut = (data && data.paymentMethod) || null
    if (
      amountDue > 0.01 &&
      remPm &&
      (remPm === 'credit_card' || remPm === 'mada')
    ) {
      paymentMethodOut = remPm
    }
    res.json({
      id: r.id,
      clubId: r.club_id,
      courtId: r.court_id,
      courtName: (data && data.courtName) || r.court_id,
      memberId: r.member_id,
      date: dateStr,
      startTime: r.start_time || r.time_slot,
      endTime: r.end_time || r.time_slot,
      status: r.status,
      totalAmount: totalAmt,
      paidAmount: paidAmt,
      amountDue,
      paymentMethod: paymentMethodOut,
      clubName: r.club_name,
      clubNameAr: r.club_name_ar,
      currency: r.currency || 'SAR'
    })
  } catch (e) {
    console.error('bookings get by id error:', e)
    res.status(500).json({ error: dbError(e) })
  }
})

/** POST /api/bookings/complete-payment - Complete payment for pending_payment booking (simulated) */
router.post('/complete-payment', async (req, res) => {
  try {
    const { bookingId, clubId } = req.body || {}
    if (!bookingId || !clubId) return res.status(400).json({ error: 'bookingId and clubId required' })
    const { rows } = await query(
      `SELECT cb.id, cb.status, cb.total_amount, cb.member_id, COALESCE(cs.currency, 'SAR') AS currency
       FROM club_bookings cb
       LEFT JOIN club_settings cs ON cs.club_id = cb.club_id
       WHERE cb.id = ? AND cb.club_id = ? AND cb.deleted_at IS NULL`,
      [bookingId, clubId]
    )
    if (!rows?.length) return res.status(404).json({ error: 'Booking not found' })
    const b = rows[0]
    if ((b.status || '') !== 'pending_payment') {
      return res.status(400).json({ error: 'Booking is not awaiting payment' })
    }
    const totalAmount = parseFloat(b.total_amount) || 0
    await bookingService.updateBookingPayment(bookingId, clubId, totalAmount, 'confirmed')
    let memberName = null
    if (b.member_id) {
      const mr = await query('SELECT name FROM members WHERE id = ? AND deleted_at IS NULL', [String(b.member_id)])
      memberName = mr?.rows?.[0]?.name || null
    }
    try {
      await invoiceService.issueInvoiceForFullBookingPayment({
        clubId,
        bookingId,
        amount: totalAmount,
        currency: b.currency,
        memberId: b.member_id,
        memberName,
        paymentMethod: 'electronic',
      })
    } catch (invErr) {
      console.warn('[complete-payment] invoice:', invErr?.message)
    }
    const { rows: bDate } = await query('SELECT booking_date FROM club_bookings WHERE id = ? AND club_id = ?', [bookingId, clubId])
    const dateStr = bDate[0]?.booking_date ? String(bDate[0].booking_date).split('T')[0] : null
    if (clubId && dateStr) slotCache.invalidateLocks(clubId, dateStr)
    res.json({ ok: true })
  } catch (e) {
    console.error('bookings complete-payment error:', e)
    res.status(500).json({ error: dbError(e) })
  }
})

/** POST /api/bookings/confirm-paid-at-club-full — Club staff: full booking, pay at club, confirm cash received */
router.post('/confirm-paid-at-club-full', async (req, res) => {
  try {
    const { bookingId, clubId } = req.body || {}
    if (!bookingId || !clubId) return res.status(400).json({ error: 'bookingId and clubId required' })
    const { rows } = await query(
      `SELECT cb.id, cb.status, cb.total_amount, cb.paid_amount, cb.member_id, cb.data,
       COALESCE(cs.currency, 'SAR') AS currency
       FROM club_bookings cb
       LEFT JOIN club_settings cs ON cs.club_id = cb.club_id
       WHERE cb.id = ? AND cb.club_id = ? AND cb.deleted_at IS NULL`,
      [bookingId, clubId]
    )
    if (!rows?.length) return res.status(404).json({ error: 'Booking not found' })
    const b = rows[0]
    const st = (b.status || '').toLowerCase()
    const data = parseBookingJsonData(b.data)
    const atClub =
      String(data.initiatorPaymentMethod || '').toLowerCase() === 'at_club' ||
      String(data.paymentMethod || '').toLowerCase() === 'at_club' ||
      String(data.initiatorPaymentMethod || '').toLowerCase() === 'pay_at_club'
    const totalAmount = parseFloat(b.total_amount) || 0
    const paidAmount = parseFloat(b.paid_amount) || 0
    const isFullPaid = totalAmount > 0.01 && paidAmount >= totalAmount - 0.02

    let memberName = null
    if (b.member_id) {
      const mr = await query('SELECT name FROM members WHERE id = ? AND deleted_at IS NULL', [String(b.member_id)])
      memberName = mr?.rows?.[0]?.name || null
    }

    let invoice = null

    if (st === 'pending_payment' && atClub) {
      await bookingService.updateBookingPayment(bookingId, clubId, totalAmount, 'confirmed')
      try {
        invoice = await invoiceService.issueInvoiceForFullBookingPayment({
          clubId,
          bookingId,
          amount: totalAmount,
          currency: b.currency,
          memberId: b.member_id,
          memberName,
          paymentMethod: 'at_club',
        })
      } catch (invErr) {
        console.warn('[confirm-paid-at-club-full] invoice:', invErr?.message)
      }
    } else if ((st === 'confirmed' || st === 'partially_paid') && isFullPaid) {
      try {
        invoice = await invoiceService.issueInvoiceForFullBookingPayment({
          clubId,
          bookingId,
          amount: totalAmount,
          currency: b.currency,
          memberId: b.member_id,
          memberName,
          paymentMethod: 'at_club',
        })
      } catch (invErr) {
        console.warn('[confirm-paid-at-club-full] invoice-only:', invErr?.message)
      }
    } else if (st === 'pending_payment' && !atClub) {
      return res.status(400).json({ error: 'This booking is not pay-at-club full payment' })
    } else {
      return res.status(400).json({ error: 'Booking is not eligible for club payment confirmation' })
    }

    const { rows: bDate } = await query('SELECT booking_date FROM club_bookings WHERE id = ? AND club_id = ?', [bookingId, clubId])
    const dateStr = bDate[0]?.booking_date ? String(bDate[0].booking_date).split('T')[0] : null
    if (clubId && dateStr) slotCache.invalidateLocks(clubId, dateStr)

    const invPayload = invoice
      ? {
          publicId: invoice.publicId || null,
          invoiceNumber: invoice.invoiceNumber,
          duplicate: !!invoice.duplicate,
        }
      : null

    res.json({
      ok: true,
      invoice: invPayload,
    })
  } catch (e) {
    console.error('bookings confirm-paid-at-club-full error:', e)
    res.status(500).json({ error: dbError(e) })
  }
})

/** POST /api/bookings/admin-purge — Club or platform admin: hard-delete booking (DB + related tables) */
router.post('/admin-purge', async (req, res) => {
  try {
    const normalized = await hasNormalizedTables()
    if (!normalized) return res.status(400).json({ error: 'Normalized tables required' })
    const { clubId, bookingId } = req.body || {}
    if (!clubId || !bookingId) return res.status(400).json({ error: 'clubId and bookingId required' })
    const actor = getActorFromRequest(req)
    const at = String(actor.actorType || '').toLowerCase()
    if (at === 'club_admin') {
      if (!actor.clubId || String(actor.clubId) !== String(clubId)) {
        return res.status(403).json({ error: 'Forbidden' })
      }
    } else if (at !== 'platform_admin') {
      return res.status(403).json({ error: 'Forbidden' })
    }
    const act = {
      actorType: actor.actorType || 'system',
      actorId: actor.actorId,
      actorName: actor.actorName,
      clubId: String(clubId),
      ipAddress: actor.ipAddress,
    }
    const bid = String(bookingId)
    const cid = String(clubId)
    const { rows: pre } = await query(
      'SELECT booking_date FROM club_bookings WHERE id = ? AND club_id = ?',
      [bid, cid]
    )
    await purgeClubBookingFromDb(cid, bid, act)
    const dateStr = pre[0]?.booking_date ? String(pre[0].booking_date).split('T')[0] : null
    if (cid && dateStr) slotCache.invalidateLocks(cid, dateStr)
    res.json({ ok: true })
  } catch (e) {
    console.error('bookings admin-purge error:', e)
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

function timeToMinutes(t) {
  const [h, m] = (t || '0:0').toString().split(':').map((x) => parseInt(x, 10) || 0)
  return h * 60 + m
}

function bookingRangesOverlap(startA, endA, startB, endB) {
  let a0 = timeToMinutes(startA)
  let a1 = timeToMinutes(endA)
  let b0 = timeToMinutes(startB)
  let b1 = timeToMinutes(endB)
  if (a1 <= a0) a1 += 24 * 60
  if (b1 <= b0) b1 += 24 * 60
  return a0 < b1 && b0 < a1
}

async function assertCourtSlotFreeExcluding(clubId, courtId, dateYmd, startTime, endTime, excludeBookingId) {
  const { rows } = await query(
    `SELECT id, start_time, end_time FROM club_bookings
     WHERE club_id = ? AND court_id = ? AND booking_date = ? AND deleted_at IS NULL AND id != ?
     AND status NOT IN ('cancelled', 'expired', 'cancelled_awaiting_refund_ack')`,
    [clubId, courtId, dateYmd, excludeBookingId]
  )
  for (const r of rows || []) {
    if (bookingRangesOverlap(String(r.start_time || ''), String(r.end_time || ''), startTime, endTime)) {
      return { ok: false }
    }
  }
  return { ok: true }
}

function parseBookingJsonData(raw) {
  if (!raw) return {}
  if (typeof raw === 'object') return { ...raw }
  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

/** Booker/member id for wallet credit (columns + booking JSON). */
function resolveBookingMemberIdForWallet(row, data) {
  const d = data && typeof data === 'object' ? data : {}
  const cands = [row?.member_id, row?.initiator_member_id, d.memberId, d.initiatorMemberId, d.member_id, d.initiator_member_id]
  for (const c of cands) {
    if (c == null || c === '') continue
    const s = String(c).trim()
    if (s && s !== 'undefined' && s !== 'null') return s
  }
  return ''
}

/**
 * Member who should receive wallet credit: refund requester first (booking_refunds), then booker columns/JSON, then paid share.
 * Order matters — club_bookings.member_id can differ from the logged-in member who requested the refund.
 */
async function resolveBookingMemberIdForWalletWithFallback(row, data, bookingId, clubId) {
  try {
    const { rows } = await query(
      `SELECT member_id FROM booking_refunds WHERE booking_id = ? AND club_id = ? ORDER BY id DESC LIMIT 1`,
      [bookingId, clubId]
    )
    const r0 = rows?.[0]?.member_id
    if (r0 != null && String(r0).trim() !== '') return String(r0).trim()
  } catch (e) {
    console.warn('[admin-fulfill-member-refund] booking_refunds lookup:', e?.message)
  }
  const fromRow = resolveBookingMemberIdForWallet(row, data)
  if (fromRow) return fromRow
  try {
    const { rows } = await query(
      `SELECT member_id FROM booking_payment_shares WHERE booking_id = ? AND club_id = ? AND paid_at IS NOT NULL AND member_id IS NOT NULL AND TRIM(COALESCE(member_id,'')) <> '' ORDER BY paid_at DESC LIMIT 1`,
      [bookingId, clubId]
    )
    const r1 = rows?.[0]?.member_id
    if (r1 != null && String(r1).trim() !== '') return String(r1).trim()
  } catch (e) {
    console.warn('[admin-fulfill-member-refund] payment_shares lookup:', e?.message)
  }
  return ''
}

/** Pay-at-club (cash at venue) — card/bank reversal does not apply. */
function initiatorUsedElectronicCard(data) {
  if (!data || typeof data !== 'object') return false
  const m = (data.initiatorPaymentMethod || data.paymentMethod || '').toString().toLowerCase().trim()
  if (!m || m === 'at_club' || m === 'pay_at_club' || m === 'cash') return false
  return ['credit_card', 'mada', 'electronic', 'card', 'online', 'stripe', 'apple_pay', 'google_pay', 'tap', 'hyperpay'].includes(m)
}

/** POST /api/bookings/member-self-service-quote */
router.post('/member-self-service-quote', async (req, res) => {
  try {
    const { bookingId, clubId, memberId } = req.body || {}
    if (!bookingId || !clubId || !memberId) return res.status(400).json({ error: 'bookingId, clubId, memberId required' })
    const { rows } = await query(
      `SELECT id, member_id, initiator_member_id, status, booking_date, start_time, end_time, court_id, total_amount, paid_amount, data
       FROM club_bookings WHERE id = ? AND club_id = ? AND deleted_at IS NULL`,
      [bookingId, clubId]
    )
    if (!rows?.length) return res.status(404).json({ error: 'Booking not found' })
    const b = rows[0]
    const owner =
      String(b.member_id || '') === String(memberId) || String(b.initiator_member_id || b.member_id || '') === String(memberId)
    if (!owner) return res.status(403).json({ error: 'Not allowed' })
    const st = (b.status || '').toLowerCase()
    if (['cancelled', 'expired', 'cancelled_awaiting_refund_ack'].includes(st)) {
      return res.status(400).json({ error: 'Booking not active' })
    }
    const data = parseBookingJsonData(b.data)
    if (data.type === 'training') return res.status(400).json({ error: 'Not available for training' })

    const settings = await getBookingSettings(clubId)
    const cnt = Math.max(0, parseInt(data.memberRescheduleCount, 10) || 0)
    const freeCap = Math.max(0, parseInt(settings.freeRescheduleCount, 10) || 1)
    const appliesFee = cnt >= freeCap
    const fee = appliesFee
      ? computePolicyFee(settings.rescheduleFeeMode, settings.rescheduleFeeValue, parseFloat(b.total_amount) || 0)
      : 0

    const dateYmd = normalizeBookingDateYmd(b.booking_date)
    const hoursLeft = hoursUntilBookingStart(dateYmd, String(b.start_time || ''))
    const minH = Math.max(0, parseInt(settings.cancelRefundHoursBefore, 10) || 24)
    const cancelAllowed = hoursLeft != null && hoursLeft >= minH
    let paidEff = parseFloat(b.paid_amount) || 0
    if (paidEff < 0.01 && st === 'confirmed') paidEff = parseFloat(b.total_amount) || 0
    const cancelFee = cancelAllowed ? computePolicyFee(settings.cancelFeeMode, settings.cancelFeeValue, paidEff) : 0
    const refundNet = Math.max(0, Math.round((paidEff - cancelFee) * 100) / 100)
    const canRequestRefundCancel =
      hoursLeft != null &&
      hoursLeft > 0 &&
      paidEff > 0.01 &&
      !['cancelled', 'expired', 'cancelled_awaiting_refund_ack'].includes(st)
    const payPrefRaw = (data.initiatorPaymentMethod || data.paymentMethod || '').toString().toLowerCase()
    const initiatorPaymentMethod = payPrefRaw || 'at_club'
    const allowElectronicRefundRoute = initiatorUsedElectronicCard(data)
    const wb = await walletService.getWalletBalance(clubId, memberId, { skipRepair: true })

    res.json({
      ok: true,
      rescheduleCount: cnt,
      freeRescheduleCount: freeCap,
      nextRescheduleFee: Math.round(fee * 100) / 100,
      cancelAllowed,
      canRequestRefundCancel,
      cancelFee: Math.round(cancelFee * 100) / 100,
      estimatedRefundNet: refundNet,
      paidAmount: paidEff,
      hoursUntilStart: hoursLeft,
      walletBalance: wb,
      initiatorPaymentMethod,
      allowElectronicRefundRoute,
    })
  } catch (e) {
    console.error('member-self-service-quote:', e)
    res.status(500).json({ error: dbError(e) })
  }
})

/** POST /api/bookings/member-reschedule-booking */
router.post('/member-reschedule-booking', async (req, res) => {
  try {
    const normalized = await hasNormalizedTables()
    if (!normalized) return res.status(400).json({ error: 'Normalized tables required' })
    const { bookingId, clubId, memberId, date: dateRaw, courtId, startTime, endTime, payFeeFromWallet } = req.body || {}
    if (!bookingId || !clubId || !memberId || !dateRaw || !courtId || !startTime || !endTime) {
      return res.status(400).json({ error: 'bookingId, clubId, memberId, date, courtId, startTime, endTime required' })
    }
    const dateYmd = (dateRaw || '').toString().replace(/T.*$/, '').trim().substring(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateYmd)) return res.status(400).json({ error: 'Invalid date' })
    if (isBookingInPast(dateYmd, startTime)) return res.status(400).json({ error: 'Cannot move to a past slot' })

    const { rows } = await query(
      `SELECT id, member_id, initiator_member_id, status, booking_date, start_time, end_time, court_id, total_amount, paid_amount, data
       FROM club_bookings WHERE id = ? AND club_id = ? AND deleted_at IS NULL`,
      [bookingId, clubId]
    )
    if (!rows?.length) return res.status(404).json({ error: 'Booking not found' })
    const b = rows[0]
    const owner =
      String(b.member_id || '') === String(memberId) || String(b.initiator_member_id || b.member_id || '') === String(memberId)
    if (!owner) return res.status(403).json({ error: 'Not allowed' })
    const st = (b.status || '').toLowerCase()
    if (['cancelled', 'expired', 'cancelled_awaiting_refund_ack'].includes(st)) {
      return res.status(400).json({ error: 'Booking not active' })
    }
    const data = parseBookingJsonData(b.data)
    if (data.type === 'training') return res.status(400).json({ error: 'Not available for training' })

    const settings = await getBookingSettings(clubId)
    const cnt = Math.max(0, parseInt(data.memberRescheduleCount, 10) || 0)
    const freeCap = Math.max(0, parseInt(settings.freeRescheduleCount, 10) || 1)
    const appliesFee = cnt >= freeCap
    const fee = appliesFee
      ? computePolicyFee(settings.rescheduleFeeMode, settings.rescheduleFeeValue, parseFloat(b.total_amount) || 0)
      : 0
    const feeR = Math.round(fee * 100) / 100

    if (feeR > 0) {
      if (!payFeeFromWallet) {
        return res.status(402).json({ error: 'Reschedule fee required', fee: feeR, requiresWallet: true })
      }
      const d = await walletService.debitWallet(clubId, memberId, feeR, { reason: 'reschedule_fee', refType: 'booking', refId: bookingId })
      if (!d.ok) return res.status(400).json({ error: d.error || 'Could not charge reschedule fee', fee: feeR })
    }

    const free = await assertCourtSlotFreeExcluding(clubId, courtId, dateYmd, startTime, endTime, bookingId)
    if (!free.ok) return res.status(409).json({ error: 'Selected slot is not available' })

    const newData = { ...data, memberRescheduleCount: cnt + 1 }
    await query(
      `UPDATE club_bookings SET booking_date = ?, court_id = ?, time_slot = ?, start_time = ?, end_time = ?, data = ? WHERE id = ? AND club_id = ?`,
      [dateYmd, courtId, startTime, startTime, endTime, JSON.stringify(newData), bookingId, clubId]
    )
    const oldDate = normalizeBookingDateYmd(b.booking_date)
    if (oldDate) slotCache.invalidateLocks(clubId, oldDate)
    slotCache.invalidateLocks(clubId, dateYmd)
    if (feeR > 0.01 && payFeeFromWallet) {
      try {
        const { rows: csFee } = await query('SELECT currency FROM club_settings WHERE club_id = ? LIMIT 1', [clubId])
        const cur = csFee?.[0]?.currency || 'SAR'
        const mnr = await query('SELECT name FROM members WHERE id = ? AND deleted_at IS NULL', [String(memberId)])
        const feeName = mnr?.rows?.[0]?.name || null
        await invoiceService.issuePaidInvoice({
          clubId,
          currency: cur,
          total: feeR,
          customerMemberId: memberId,
          customerName: feeName,
          customerPhone: null,
          sourceType: 'booking_fee',
          sourceRef: `${bookingId}:reschedule:${cnt + 1}`,
          idempotencyKey: `brsf:${clubId}:${bookingId}:${cnt + 1}`,
          paymentMethod: 'wallet',
          externalRef: null,
          lineDescriptionEn: `Reschedule fee — booking ${bookingId}`,
          lineDescriptionAr: `رسوم إعادة جدولة — حجز ${bookingId}`,
        })
      } catch (invE) {
        console.warn('[member-reschedule-booking] invoice:', invE?.message)
      }
    }
    res.json({ ok: true, rescheduleFeeCharged: feeR })
  } catch (e) {
    console.error('member-reschedule-booking:', e)
    res.status(500).json({ error: dbError(e) })
  }
})

/** POST /api/bookings/member-refund-request — member cancels paid booking; refund preference stored; club fulfills cash/wallet/electronic */
router.post('/member-refund-request', async (req, res) => {
  try {
    const normalized = await hasNormalizedTables()
    if (!normalized) return res.status(400).json({ error: 'Normalized tables required' })
    const { bookingId, clubId, memberId, refundRoute } = req.body || {}
    if (!bookingId || !clubId || !memberId || !refundRoute) {
      return res.status(400).json({ error: 'bookingId, clubId, memberId, refundRoute required' })
    }
    const rawRoute = String(refundRoute).toLowerCase()
    const route =
      rawRoute === 'wallet'
        ? 'wallet'
        : rawRoute === 'electronic' || rawRoute === 'original' || rawRoute === 'cash'
          ? rawRoute === 'electronic'
            ? 'electronic'
            : 'cash'
          : null
    if (!route) return res.status(400).json({ error: 'refundRoute must be wallet, cash, original, or electronic' })

    const { rows: paidShareCheck } = await query(
      `SELECT id FROM booking_payment_shares WHERE booking_id = ? AND club_id = ? AND removed_at IS NULL AND paid_at IS NOT NULL LIMIT 1`,
      [bookingId, clubId]
    ).catch(() => ({ rows: [] }))
    if (paidShareCheck?.length) {
      return res.status(400).json({ error: 'Split-payment booking: contact the club to arrange refund.' })
    }

    const { rows } = await query(
      `SELECT id, member_id, initiator_member_id, status, booking_date, start_time, total_amount, paid_amount, data
       FROM club_bookings WHERE id = ? AND club_id = ? AND deleted_at IS NULL`,
      [bookingId, clubId]
    )
    if (!rows?.length) return res.status(404).json({ error: 'Booking not found' })
    const b = rows[0]
    const owner =
      String(b.member_id || '') === String(memberId) || String(b.initiator_member_id || b.member_id || '') === String(memberId)
    if (!owner) return res.status(403).json({ error: 'Not allowed' })
    const st = (b.status || '').toLowerCase()
    if (['cancelled', 'expired', 'cancelled_awaiting_refund_ack'].includes(st)) {
      return res.status(400).json({ error: 'Booking not active' })
    }
    const data = parseBookingJsonData(b.data)
    if (data.type === 'training') return res.status(400).json({ error: 'Not available for training' })
    if (route === 'electronic' && !initiatorUsedElectronicCard(data)) {
      return res.status(400).json({
        error: 'Electronic refund applies only when the booking was paid by card or online.',
      })
    }

    const settings = await getBookingSettings(clubId)
    const dateYmd = normalizeBookingDateYmd(b.booking_date)
    const hoursLeft = hoursUntilBookingStart(dateYmd, String(b.start_time || ''))
    if (hoursLeft == null || hoursLeft <= 0) {
      return res.status(400).json({ error: 'Cannot cancel after booking start' })
    }

    let paid = parseFloat(b.paid_amount) || 0
    if (paid < 0.01 && st === 'confirmed') paid = parseFloat(b.total_amount) || 0

    const actor = { actorType: 'member', actorId: String(memberId) }

    if (paid < 0.01) {
      await bookingService.cancelBooking(bookingId, clubId, actor)
      await lock.deleteLockByBooking(bookingId)
      if (dateYmd) slotCache.invalidateLocks(clubId, dateYmd)
      return res.json({ ok: true, immediateCancel: true, netAmount: 0 })
    }

    const minH = Math.max(0, parseInt(settings.cancelRefundHoursBefore, 10) || 24)
    const withinPolicy = hoursLeft >= minH
    const cancelFee = withinPolicy ? computePolicyFee(settings.cancelFeeMode, settings.cancelFeeValue, paid) : 0
    const net = Math.max(0, Math.round((paid - cancelFee) * 100) / 100)

    const newData = {
      ...data,
      memberSelfCancel: true,
      memberSelfCancelAt: new Date().toISOString(),
      memberRefundPreference: route,
      memberRefundNet: net,
      memberRefundFee: cancelFee,
      memberRefundGross: paid,
      memberRefundOutsidePolicy: !withinPolicy,
    }
    await query(
      `UPDATE club_bookings SET status = 'cancelled_awaiting_refund_ack', data = ? WHERE id = ? AND club_id = ?`,
      [JSON.stringify(newData), bookingId, clubId]
    )
    await lock.deleteLockByBooking(bookingId)
    if (dateYmd) slotCache.invalidateLocks(clubId, dateYmd)

    const expectedBy = new Date()
    expectedBy.setDate(expectedBy.getDate() + (settings.refundDays || 3))
    try {
      await query(
        `INSERT INTO booking_refunds (booking_id, club_id, member_id, amount, status, expected_by_date, refund_route, fee_amount, net_amount)
         VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?)`,
        [bookingId, clubId, memberId, paid, expectedBy.toISOString().split('T')[0], route, cancelFee, net]
      )
    } catch (brErr) {
      try {
        await query(
          'INSERT INTO booking_refunds (booking_id, club_id, member_id, amount, status, expected_by_date) VALUES (?, ?, ?, ?, ?, ?)',
          [bookingId, clubId, memberId, paid, 'pending', expectedBy.toISOString().split('T')[0]]
        )
      } catch (e2) {
        console.warn('booking_refunds:', e2?.message)
      }
    }

    res.json({ ok: true, refundRoute: route, fee: cancelFee, netAmount: net, awaitingClubFulfillment: true })
  } catch (e) {
    console.error('member-refund-request:', e)
    res.status(500).json({ error: dbError(e) })
  }
})

/** POST /api/bookings/admin-fulfill-member-refund — club confirms refund: cash, wallet credit, or electronic (manual / bank) */
router.post('/admin-fulfill-member-refund', async (req, res) => {
  try {
    const normalized = await hasNormalizedTables()
    if (!normalized) return res.status(400).json({ error: 'Normalized tables required' })
    const { bookingId, clubId, fulfillment } = req.body || {}
    if (!bookingId || !clubId || !fulfillment) {
      return res.status(400).json({ error: 'bookingId, clubId, fulfillment required' })
    }
    const actor = getActorFromRequest(req)
    const at = String(actor.actorType || '').toLowerCase()
    if (at === 'club_admin') {
      if (!actor.clubId || String(actor.clubId) !== String(clubId)) {
        return res.status(403).json({ error: 'Forbidden' })
      }
    } else if (at !== 'platform_admin') {
      return res.status(403).json({ error: 'Forbidden' })
    }
    const f = String(fulfillment).toLowerCase()
    if (!['cash', 'wallet', 'electronic'].includes(f)) {
      return res.status(400).json({ error: 'fulfillment must be cash, wallet, or electronic' })
    }

    const { rows } = await query(
      `SELECT member_id, initiator_member_id, paid_amount, total_amount, status, data FROM club_bookings WHERE id = ? AND club_id = ? AND deleted_at IS NULL`,
      [bookingId, clubId]
    )
    if (!rows?.length) return res.status(404).json({ error: 'Booking not found' })
    const b = rows[0]
    const st = (b.status || '').toLowerCase()
    const prevData = parseBookingJsonData(b.data)
    const hasMemberRefundIntent = !!(prevData.memberRefundPreference || prevData.memberSelfCancel)
    if (!hasMemberRefundIntent) {
      return res.status(400).json({ error: 'No member refund request on this booking' })
    }
    const awaitingAck = st === 'cancelled_awaiting_refund_ack'
    const repairIncompleteFulfillment = st === 'cancelled' && !prevData.clubRefundFulfilledAt
    if (!awaitingAck && !repairIncompleteFulfillment) {
      return res.status(400).json({ error: 'Booking is not awaiting refund fulfillment' })
    }

    let net = parseFloat(prevData.memberRefundNet)
    if (!Number.isFinite(net) || net < 0) net = parseFloat(b.paid_amount) || 0
    if (net < 0.01) net = parseFloat(b.total_amount) || 0
    net = Math.round(net * 100) / 100

    const mid = await resolveBookingMemberIdForWalletWithFallback(b, prevData, bookingId, clubId)

    if (f === 'wallet') {
      if (!Number.isFinite(net) || net < 0.01) {
        return res.status(400).json({ error: 'Refund amount is zero or invalid for wallet credit' })
      }
      if (!mid) {
        return res.status(400).json({ error: 'Cannot credit wallet: booking has no member id on record' })
      }
      const alreadyCredited = await walletService.hasBookingRefundCredit(clubId, mid, bookingId)
      if (!alreadyCredited) {
        const cr = await walletService.creditWallet(clubId, mid, net, {
          reason: 'booking_refund_club_confirmed',
          refType: 'booking',
          refId: String(bookingId),
        })
        if (!cr.ok) return res.status(400).json({ error: cr.error || 'Wallet credit failed' })
      }
    }

    const act = {
      actorType: actor.actorType || 'system',
      actorId: actor.actorId,
      actorName: actor.actorName,
      clubId: String(clubId),
      ipAddress: actor.ipAddress,
    }
    const merged = {
      ...prevData,
      clubRefundFulfilledAt: new Date().toISOString(),
      clubRefundFulfillment: f,
      clubRefundAmount: net,
    }
    await query(`UPDATE club_bookings SET status = 'cancelled', paid_amount = 0, data = ? WHERE id = ? AND club_id = ?`, [
      JSON.stringify(merged),
      bookingId,
      clubId,
    ])

    try {
      await query(
        `UPDATE booking_refunds SET status = 'completed' WHERE booking_id = ? AND club_id = ? AND status = 'pending' ORDER BY id DESC LIMIT 1`,
        [bookingId, clubId]
      )
    } catch (e) {
      console.warn('[admin-fulfill-member-refund] booking_refunds:', e?.message)
    }

    try {
      await invoiceService.voidClubInvoicesForBookingRefund(clubId, bookingId)
    } catch (invE) {
      console.warn('[admin-fulfill-member-refund] invoice void:', invE?.message)
    }

    await logAudit({
      tableName: 'club_bookings',
      recordId: String(bookingId),
      action: 'UPDATE',
      ...act,
      newValue: { refundFulfilled: f, amount: net },
    })

    const { rows: dr } = await query('SELECT booking_date FROM club_bookings WHERE id = ? AND club_id = ?', [bookingId, clubId])
    const dateStr = bookingService.normalizeBookingDateYmd(dr[0]?.booking_date)
    if (clubId && dateStr) slotCache.invalidateLocks(clubId, dateStr)

    res.json({ ok: true, fulfillment: f, netAmount: net })
  } catch (e) {
    console.error('admin-fulfill-member-refund:', e)
    res.status(500).json({ error: dbError(e) })
  }
})

export default router
