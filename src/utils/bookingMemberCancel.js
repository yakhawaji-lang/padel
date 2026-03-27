/**
 * Member self-service cancel / refund flags on club bookings (synced from DB `data` JSON).
 */

export const TERMINAL_BOOKING_STATUSES = ['cancelled', 'expired', 'cancelled_awaiting_refund_ack']

/**
 * True when a booking no longer counts as an active reservation on calendars / KPIs.
 * Accepts US spelling, mixed case from APIs, and prefixed variants e.g. cancelled_awaiting_...
 */
export function isTerminalBookingStatus(status) {
  const s = (status || '').toString().trim().toLowerCase().replace(/\s+/g, '_').replace(/-+/g, '_')
  if (!s) return false
  if (TERMINAL_BOOKING_STATUSES.includes(s)) return true
  if (s === 'canceled' || s === 'cancelled') return true
  if (s === 'expired') return true
  if (s.startsWith('cancelled_') || s.startsWith('canceled_')) return true
  return false
}

export function bookingJsonData(booking) {
  const d = booking?.data
  if (d && typeof d === 'object') return d
  if (typeof d === 'string') {
    try {
      return JSON.parse(d)
    } catch {
      return {}
    }
  }
  return {}
}

/** True when booking `data` or top-level marks member self-cancel (from API / local). */
export function hasMemberSelfCancelFlag(booking) {
  const d = bookingJsonData(booking)
  return !!(booking?.memberSelfCancel || d.memberSelfCancel)
}

/**
 * Booking was cancelled by the member (self-service), not only by staff.
 * Uses terminal status + memberSelfCancel in JSON or deletedBy matching booker.
 */
export function isMemberCancelledBooking(booking) {
  if (!isTerminalBookingStatus(booking?.status)) return false
  if (hasMemberSelfCancelFlag(booking)) return true
  const mid = String(booking?.memberId || booking?.initiatorMemberId || '').trim()
  const db = String(booking?.deletedBy || booking?.deleted_by || '').trim()
  return !!(mid && db && db === mid)
}

/** Active calendars (club app weekly / court view): never show ended / cancelled rows. */
export function shouldHideMemberCancelledFromClubCalendar(booking) {
  return isTerminalBookingStatus(booking?.status)
}

/** Any collected payment still on the booking (DB paid_amount or split shares). */
export function bookingHasCollectedPayment(booking) {
  if (!booking) return false
  const st = (booking.status || '').toString().toLowerCase()
  const paid = parseFloat(booking.paidAmount ?? booking.paid_amount) || 0
  if (paid > 0.01) return true
  const shares = Array.isArray(booking.paymentShares) ? booking.paymentShares : []
  for (const s of shares) {
    const paidAt = s.paidAt || s.paid_at
    const refundedAt = s.refundedAt || s.refunded_at
    if (paidAt && !refundedAt) return true
  }
  if (st === 'partially_paid') return true
  return false
}
