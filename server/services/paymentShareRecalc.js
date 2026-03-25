/**
 * إعادة حساب paid_amount و status للحجز بعد تغيير حصص الدفع (دفع/استرداد/إزالة)
 */
import { query } from '../db/pool.js'
import * as bookingService from './bookingService.js'

export function shareRowCountsAsPaid(row) {
  if (!row) return false
  if (row.removed_at) return false
  if (!row.paid_at) return false
  if (row.refunded_at) return false
  return true
}

/** حصة تُعرض كمشارك نشط (غير مُزال) */
export function shareRowIsActive(row) {
  if (!row) return false
  return !row.removed_at
}

/**
 * @param {string} bookingId
 * @param {string} clubId
 * @param {{ forceStatus?: string }} [opts]
 */
export async function recalculateBookingPaymentAfterShareChange(bookingId, clubId, opts = {}) {
  const { rows: bRows } = await query(
    `SELECT total_amount, status, data FROM club_bookings WHERE id = ? AND club_id = ? AND deleted_at IS NULL`,
    [bookingId, clubId]
  )
  if (!bRows?.length) return null

  let sharesRes
  try {
    sharesRes = await query(
      `SELECT amount, paid_at, refunded_at, removed_at FROM booking_payment_shares WHERE booking_id = ? AND club_id = ?`,
      [bookingId, clubId]
    )
  } catch (e) {
    if (!e?.message?.includes('refunded_at') && !e?.message?.includes('removed_at')) throw e
    sharesRes = await query(
      `SELECT amount, paid_at, NULL AS refunded_at, NULL AS removed_at FROM booking_payment_shares WHERE booking_id = ? AND club_id = ?`,
      [bookingId, clubId]
    )
  }
  const shares = sharesRes?.rows || []

  const paidAmount = shares.filter(shareRowCountsAsPaid).reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0)
  const totalAmount = parseFloat(bRows[0].total_amount) || 0
  let status = (bRows[0].status || '').toString()
  const forceStatus = opts.forceStatus

  if (forceStatus) {
    status = forceStatus
  } else if (status === 'cancelled_awaiting_refund_ack') {
    let pendRes
    try {
      pendRes = await query(
        `SELECT COUNT(*) AS c FROM booking_payment_shares
         WHERE booking_id = ? AND club_id = ?
         AND refunded_at IS NOT NULL AND refund_acknowledged_at IS NULL`,
        [bookingId, clubId]
      )
    } catch (_) {
      pendRes = { rows: [{ c: 0 }] }
    }
    const pending = pendRes?.rows?.[0]?.c ?? 0
    if (Number(pending) === 0) {
      status = 'cancelled'
    }
  } else if (['cancelled', 'expired'].includes(status)) {
    /* keep */
  } else {
    const allPaid = totalAmount > 0 && paidAmount >= totalAmount - 0.01
    if (allPaid) status = 'confirmed'
    else if (paidAmount > 0) status = 'partially_paid'
    else status = 'pending_payments'
  }

  await bookingService.updateBookingPayment(bookingId, clubId, paidAmount, status)

  // بعد استرداد جزئي قد يصبح الحجز pending/partially_paid مع payment_deadline_at قديم فيقرر job الانتهاء فوراً
  const stillAwaitingPayment =
    !forceStatus &&
    status !== 'cancelled_awaiting_refund_ack' &&
    ['initiated', 'locked', 'pending_payments', 'pending_payment', 'partially_paid'].includes(status)
  if (stillAwaitingPayment) {
    await bookingService.extendPaymentDeadlineAfterShareProgress(bookingId, clubId)
  }

  const { rows: dateRow } = await query('SELECT booking_date FROM club_bookings WHERE id = ? AND club_id = ?', [bookingId, clubId])
  const dateStr = bookingService.normalizeBookingDateYmd(dateRow[0]?.booking_date)

  return { paidAmount, status, bookingDate: dateStr }
}
