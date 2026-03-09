/**
 * Booking settings - fetch club-specific booking configuration from DB
 */
import { query } from './pool.js'

const DEFAULTS = {
  lockMinutes: 10,
  paymentDeadlineMinutes: 10,
  splitManageMinutes: 15,
  splitPaymentDeadlineMinutes: 30,
  refundDays: 3,
  allowIncompleteBookings: false
}

/**
 * Get booking settings for a club
 */
export async function getBookingSettings(clubId) {
  if (!clubId) return DEFAULTS
  try {
    const { rows } = await query(
      'SELECT lock_minutes, payment_deadline_minutes, split_manage_minutes, split_payment_deadline_minutes, refund_days, allow_incomplete_bookings FROM club_settings WHERE club_id = ?',
      [clubId]
    )
    const r = rows[0]
    if (!r) return DEFAULTS
    return {
      lockMinutes: r.lock_minutes ?? DEFAULTS.lockMinutes,
      paymentDeadlineMinutes: r.payment_deadline_minutes ?? DEFAULTS.paymentDeadlineMinutes,
      splitManageMinutes: r.split_manage_minutes ?? DEFAULTS.splitManageMinutes,
      splitPaymentDeadlineMinutes: r.split_payment_deadline_minutes ?? DEFAULTS.splitPaymentDeadlineMinutes,
      refundDays: r.refund_days ?? DEFAULTS.refundDays,
      allowIncompleteBookings: !!r.allow_incomplete_bookings
    }
  } catch (e) {
    if (!e?.message?.includes("doesn't exist") && !e?.message?.includes('Unknown column')) {
      console.warn('getBookingSettings:', e?.message)
    }
    return DEFAULTS
  }
}
