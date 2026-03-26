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
 * After share/recalc or admin edit: reset payment_deadline to now + club split_payment_deadline_minutes
 * (capped at end of booking_date local calendar day). Uses exact setting (min 1 minute).
 */
export async function extendPaymentDeadlineAfterShareProgress(bookingId, clubId) {
  const { rows } = await query(
    `SELECT cb.booking_date, cs.split_payment_deadline_minutes
     FROM club_bookings cb
     LEFT JOIN club_settings cs ON cs.club_id = cb.club_id
     WHERE cb.id = ? AND cb.club_id = ? AND cb.deleted_at IS NULL`,
    [bookingId, clubId]
  )
  if (!rows?.length) return null
  const dateYmd = normalizeBookingDateYmd(rows[0].booking_date)
  const rawMins = parseInt(rows[0].split_payment_deadline_minutes, 10)
  const mins = Number.isFinite(rawMins) && rawMins > 0 ? rawMins : 30
  const fromNowMs = Date.now() + mins * 60 * 1000
  let deadlineMs = fromNowMs
  if (dateYmd) {
    const [y, mo, d] = dateYmd.split('-').map(Number)
    if (y && mo && d) {
      const endOfBookingDay = new Date(y, mo - 1, d, 23, 59, 59, 999)
      if (!Number.isNaN(endOfBookingDay.getTime())) {
        deadlineMs = Math.min(fromNowMs, endOfBookingDay.getTime())
      }
    }
  }
  const deadline = new Date(deadlineMs)
  await updateBookingPaymentDeadline(bookingId, clubId, deadline)
  return deadline
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
