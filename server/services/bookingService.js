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

/**
 * إلغاء حجز (soft delete + status cancelled)
 */
export async function cancelBooking(bookingId, clubId, actor = {}) {
  await query(
    'UPDATE club_bookings SET status = ?, deleted_at = NOW(), deleted_by = ? WHERE id = ? AND club_id = ?',
    ['cancelled', actor.actorId || null, bookingId, clubId]
  )
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
 * After a participant pays (or club marks a share paid), move payment_deadline_at forward so the
 * expire job does not immediately re-mark partially_paid bookings as expired.
 * Uses max(now + split_payment_deadline_minutes, end of booking_date local day).
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
  const dateStr = rows[0].booking_date ? String(rows[0].booking_date).split('T')[0] : null
  const mins = Math.max(15, parseInt(rows[0].split_payment_deadline_minutes, 10) || 30)
  const fromNow = new Date(Date.now() + mins * 60 * 1000)
  const endOfBookingDay = dateStr ? new Date(dateStr + 'T23:59:59') : fromNow
  const deadline = new Date(Math.max(fromNow.getTime(), endOfBookingDay.getTime()))
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
