/**
 * خدمة الحجوزات - نقطة مركزية لإنشاء/إلغاء/تحديث حجوزات club_bookings
 * تستخدم من routes/bookings و jobs/bookingJobs
 */
import { query } from '../db/pool.js'
import { logAudit } from '../db/audit.js'

/**
 * إنشاء حجز جديد في club_bookings
 * @param {Object} params
 * @returns {Promise<{ bookingId: string }>}
 */
export async function createBooking(params) {
  const {
    id: bid,
    clubId,
    courtId,
    memberId,
    date,
    timeSlot,
    startTime,
    endTime,
    status,
    totalAmount = 0,
    paidAmount = 0,
    initiatorMemberId,
    paymentDeadline,
    dataJson,
    createdBy
  } = params
  await query(
    `INSERT INTO club_bookings (id, club_id, court_id, member_id, booking_date, time_slot, start_time, end_time, status, total_amount, paid_amount, initiator_member_id, locked_at, payment_deadline_at, data, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?)`,
    [bid, clubId, courtId, memberId, date, timeSlot, startTime, endTime, status, totalAmount, paidAmount, initiatorMemberId || memberId, paymentDeadline, dataJson, createdBy || null]
  )
  return { bookingId: bid }
}

function parseBookingDataJson(raw) {
  if (!raw) return {}
  if (typeof raw === 'object') return { ...raw }
  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

/**
 * Minutes until split-payment deadline for a booking: regular → split_payment_deadline_minutes;
 * King of the Court / Social Tournament → club tournament-specific columns (fallback to general split).
 * @param {object} settings — row or getBookingSettings() object (camelCase or snake_case ok)
 * @param {object|string} bookingDataRaw — booking `data` JSON or object (isTournament, tournamentType)
 */
export function pickSplitPaymentDeadlineMinutes(settings, bookingDataRaw) {
  const splitRaw =
    settings?.splitPaymentDeadlineMinutes ?? settings?.split_payment_deadline_minutes ?? 30
  const split = Math.max(1, Math.min(43200, parseInt(splitRaw, 10) || 30))
  const kingRaw =
    settings?.tournamentKingSplitPaymentDeadlineMinutes ??
    settings?.tournament_king_split_payment_deadline_minutes
  const socialRaw =
    settings?.tournamentSocialSplitPaymentDeadlineMinutes ??
    settings?.tournament_social_split_payment_deadline_minutes
  const king = parseInt(kingRaw, 10)
  const social = parseInt(socialRaw, 10)

  let d = {}
  try {
    d =
      typeof bookingDataRaw === 'object' && bookingDataRaw !== null
        ? bookingDataRaw
        : JSON.parse(String(bookingDataRaw || '{}'))
  } catch {
    d = {}
  }
  const isTournament =
    d.isTournament === true || d.tournamentType != null || d.tournament_type != null
  if (!isTournament) return split
  const tt = String(d.tournamentType || d.tournament_type || 'king').toLowerCase()
  if (tt === 'social') {
    const m = Number.isFinite(social) && social > 0 ? social : split
    return Math.max(1, Math.min(43200, m))
  }
  const m = Number.isFinite(king) && king > 0 ? king : split
  return Math.max(1, Math.min(43200, m))
}

/**
 * إلغاء حجز (حالة ملغي — بدون deleted_at حتى تبقى مرئية في لوحة النادي)
 * عند الإلغاء من العضو يُعلَّم data.memberSelfCancel لعرضها في تبويب مخصص.
 */
export async function cancelBooking(bookingId, clubId, actor = {}) {
  const actorType = String(actor.actorType || '').toLowerCase()
  const isMember = actorType === 'member'
  let dataJson = null
  if (isMember) {
    const { rows } = await query('SELECT data FROM club_bookings WHERE id = ? AND club_id = ?', [bookingId, clubId])
    const prev = parseBookingDataJson(rows?.[0]?.data)
    dataJson = JSON.stringify({
      ...prev,
      memberSelfCancel: true,
      memberSelfCancelAt: new Date().toISOString()
    })
  }
  if (dataJson != null) {
    await query(
      'UPDATE club_bookings SET status = ?, deleted_by = ?, data = ? WHERE id = ? AND club_id = ?',
      ['cancelled', actor.actorId || null, dataJson, bookingId, clubId]
    )
  } else {
    await query(
      'UPDATE club_bookings SET status = ?, deleted_by = ? WHERE id = ? AND club_id = ?',
      ['cancelled', actor.actorId || null, bookingId, clubId]
    )
  }
  await logAudit({ tableName: 'club_bookings', recordId: bookingId, action: 'UPDATE', ...actor, clubId, newValue: { status: 'cancelled' } })
}

/**
 * تحديث مبلغ المدفوع وحالة الحجز (مثلاً بعد تسجيل دفعة)
 */
export async function updateBookingPayment(bookingId, clubId, paidAmount, status) {
  await query(
    'UPDATE club_bookings SET paid_amount = ?, status = ? WHERE id = ? AND club_id = ?',
    [paidAmount, status, bookingId, clubId]
  )
}

/**
 * تحديث موعد مهلة الدفع للحجز
 */
export async function updateBookingPaymentDeadline(bookingId, clubId, paymentDeadlineAt) {
  await query(
    'UPDATE club_bookings SET payment_deadline_at = ? WHERE id = ? AND club_id = ?',
    [paymentDeadlineAt, bookingId, clubId]
  )
}

/**
 * Normalize DB booking_date (string YYYY-MM-DD, Date, or driver-specific) to YYYY-MM-DD.
 * Avoids Invalid Date when mysql2 returns a Date and String(d).split('T')[0] is wrong.
 */
export function normalizeBookingDateYmd(bookingDate) {
  if (bookingDate == null) return null
  if (typeof bookingDate === 'string') {
    const m = bookingDate.trim().match(/^(\d{4}-\d{2}-\d{2})/)
    return m ? m[1] : null
  }
  if (bookingDate instanceof Date && !Number.isNaN(bookingDate.getTime())) {
    const y = bookingDate.getFullYear()
    const mo = String(bookingDate.getMonth() + 1).padStart(2, '0')
    const d = String(bookingDate.getDate()).padStart(2, '0')
    return `${y}-${mo}-${d}`
  }
  const m = String(bookingDate).match(/(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : null
}

/**
 * New payment deadline: now + minutes, optionally capped by end of booking calendar day (only if that end is still in the future).
 */
export function computePaymentDeadlineFromMinutes(bookingDateYmd, minutes) {
  const mins = Math.max(1, Math.min(43200, parseInt(minutes, 10) || 30))
  let deadlineMs = Date.now() + mins * 60 * 1000
  if (bookingDateYmd) {
    const [y, mo, d] = bookingDateYmd.split('-').map(Number)
    if (y && mo && d) {
      const endOfBookingDay = new Date(y, mo - 1, d, 23, 59, 59, 999)
      if (!Number.isNaN(endOfBookingDay.getTime()) && endOfBookingDay.getTime() > Date.now()) {
        deadlineMs = Math.min(deadlineMs, endOfBookingDay.getTime())
      }
    }
  }
  return new Date(deadlineMs)
}

/**
 * After share/recalc or admin edit: reset payment_deadline to now + effective split minutes
 * (regular vs King / Social tournament club settings; or overrideMinutes when provided).
 */
export async function extendPaymentDeadlineAfterShareProgress(bookingId, clubId, overrideMinutes = undefined) {
  const { rows } = await query(
    `SELECT cb.booking_date, cb.data,
      cs.split_payment_deadline_minutes,
      cs.tournament_king_split_payment_deadline_minutes,
      cs.tournament_social_split_payment_deadline_minutes
     FROM club_bookings cb
     LEFT JOIN club_settings cs ON cs.club_id = cb.club_id
     WHERE cb.id = ? AND cb.club_id = ? AND cb.deleted_at IS NULL`,
    [bookingId, clubId]
  )
  if (!rows?.length) return null
  const dateYmd = normalizeBookingDateYmd(rows[0].booking_date)
  let dataParsed = {}
  try {
    dataParsed =
      typeof rows[0].data === 'object' && rows[0].data !== null
        ? rows[0].data
        : JSON.parse(rows[0].data || '{}')
  } catch {
    dataParsed = {}
  }
  const settingMins = pickSplitPaymentDeadlineMinutes(
    {
      split_payment_deadline_minutes: rows[0].split_payment_deadline_minutes,
      tournament_king_split_payment_deadline_minutes: rows[0].tournament_king_split_payment_deadline_minutes,
      tournament_social_split_payment_deadline_minutes: rows[0].tournament_social_split_payment_deadline_minutes,
    },
    dataParsed
  )
  const om = overrideMinutes != null && overrideMinutes !== '' ? parseInt(overrideMinutes, 10) : NaN
  const mins = Number.isFinite(om) && om > 0 ? Math.max(1, Math.min(43200, om)) : settingMins
  const deadline = computePaymentDeadlineFromMinutes(dateYmd, mins)
  await updateBookingPaymentDeadline(bookingId, clubId, deadline)
  return deadline
}

/**
 * Club extends split payment time after automated expiry: restore awaiting-payment status and new deadline.
 */
export async function reactivateExpiredSplitBooking(bookingId, clubId, extendMinutes) {
  const { rows } = await query(
    `SELECT id, status, total_amount, paid_amount, booking_date, data FROM club_bookings WHERE id = ? AND club_id = ? AND deleted_at IS NULL`,
    [bookingId, clubId]
  )
  if (!rows?.length) return { error: 'not_found' }
  const st = (rows[0].status || '').toString().toLowerCase()
  if (st !== 'expired') return { error: 'not_expired' }

  let sharesRes
  try {
    sharesRes = await query(
      `SELECT amount, paid_at, refunded_at, removed_at FROM booking_payment_shares WHERE booking_id = ? AND club_id = ?`,
      [bookingId, clubId]
    )
  } catch (_) {
    return { error: 'shares_lookup_failed' }
  }
  const shares = sharesRes?.rows || []
  if (shares.length === 0) return { error: 'not_split' }

  let paidAmount = 0
  for (const s of shares) {
    if (s.removed_at) continue
    if (!s.paid_at) continue
    if (s.refunded_at) continue
    paidAmount += parseFloat(s.amount) || 0
  }
  const totalAmount = parseFloat(rows[0].total_amount) || 0
  if (totalAmount > 0.01 && paidAmount >= totalAmount - 0.01) {
    return { error: 'already_fully_paid' }
  }

  const newStatus = paidAmount > 0.01 ? 'partially_paid' : 'pending_payments'
  const dateYmd = normalizeBookingDateYmd(rows[0].booking_date)
  let dataParsed = {}
  try {
    dataParsed =
      typeof rows[0].data === 'object' && rows[0].data !== null
        ? rows[0].data
        : JSON.parse(rows[0].data || '{}')
  } catch {
    dataParsed = {}
  }
  const om = extendMinutes != null && extendMinutes !== '' ? parseInt(extendMinutes, 10) : NaN
  let minsToUse
  if (Number.isFinite(om) && om > 0) {
    minsToUse = Math.max(1, Math.min(43200, om))
  } else {
    const { rows: srows } = await query(
      `SELECT split_payment_deadline_minutes, tournament_king_split_payment_deadline_minutes, tournament_social_split_payment_deadline_minutes
       FROM club_settings WHERE club_id = ?`,
      [clubId]
    )
    minsToUse = pickSplitPaymentDeadlineMinutes(srows?.[0] || {}, dataParsed)
  }
  const deadline = computePaymentDeadlineFromMinutes(dateYmd, minsToUse)

  await query(
    `UPDATE club_bookings SET status = ?, payment_deadline_at = ?, paid_amount = ? WHERE id = ? AND club_id = ?`,
    [newStatus, deadline, paidAmount, bookingId, clubId]
  )
  return { ok: true, status: newStatus, paymentDeadlineAt: deadline, paidAmount }
}

/**
 * انتهاء صلاحية حجوزات غير المدفوعة (يستدعيها job)
 * @returns {Promise<number>} عدد الحجوزات التي تم تحديثها
 */
export async function expireUnpaidBookings() {
  const { rows } = await query(`
    SELECT id, club_id, booking_date FROM club_bookings
    WHERE status IN ('initiated', 'locked', 'pending_payments', 'partially_paid')
    AND payment_deadline_at IS NOT NULL AND payment_deadline_at < NOW()
  `)
  if (!rows?.length) return 0
  await query(`
    UPDATE club_bookings SET status = 'expired'
    WHERE status IN ('initiated', 'locked', 'pending_payments', 'partially_paid')
    AND payment_deadline_at IS NOT NULL AND payment_deadline_at < NOW()
  `)
  return rows.length
}
