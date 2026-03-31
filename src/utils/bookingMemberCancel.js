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

/**
 * Split participant requested refund; club must fulfill. Uses DB columns on the share and/or
 * flags written to booking `data` when the member submits the request (see mergeClubBookingDataJson).
 */
export function shareHasMemberRefundPending(share, booking) {
  if (!share) return false
  const isRefunded = !!(share.refundedAt || share.refunded_at)
  const isRemoved = !!(share.removedAt || share.removed_at)
  if (isRefunded || isRemoved) return false
  if (share.memberRefundRequestedAt || share.member_refund_requested_at) return true
  const d = bookingJsonData(booking)
  const flag = booking?.splitMemberRefundPending ?? d.splitMemberRefundPending
  const sid = booking?.splitMemberRefundShareId ?? d.splitMemberRefundShareId
  if (flag && sid != null && sid !== '' && String(sid) === String(share.id ?? '')) return true
  return false
}

/** Any active split share is awaiting club fulfillment of a member refund request. */
export function bookingHasPendingMemberShareRefund(booking) {
  const shares = Array.isArray(booking?.paymentShares) ? booking.paymentShares : []
  if (!shares.length) return false
  return shares.some((s) => shareHasMemberRefundPending(s, booking))
}

/**
 * Booking needs club refund attention: cancelled awaiting club acknowledgment/fulfillment,
 * or a split participant requested a refund and the share is still pending.
 */
export function bookingHasRefundRequestPending(booking) {
  if (!booking) return false
  const st = (booking.status || '').toString().trim().toLowerCase().replace(/-/g, '_')
  if (st === 'cancelled_awaiting_refund_ack') return true
  return bookingHasPendingMemberShareRefund(booking)
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

/**
 * Club admin still owes a member-initiated refund (cash / wallet / bank) until marked fulfilled.
 * Keeps the booking row from showing "cancelled before payment — no refund" when payment was
 * collected and a refund path was chosen, even if paid_amount was zeroed on cancel.
 */
export function bookingNeedsClubRefundFollowUp(booking) {
  const d = bookingJsonData(booking)
  const st = (booking?.status || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/-/g, '_')
    .replace(/\s+/g, '_')
  if (st === 'cancelled_awaiting_refund_ack') return true
  if (d.clubRefundFulfilledAt) return false
  const hasIntent = !!(
    d.memberRefundPreference ||
    d.memberSelfCancel ||
    d.member_refund_preference ||
    d.member_self_cancel
  )
  if (!hasIntent) return false
  if (!isTerminalBookingStatus(booking?.status)) return false
  return true
}
