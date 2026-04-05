/**
 * Effective amounts for split-payment shares when DB `amount` is 0:
 * distribute (booking total − sum of positive share amounts) across active zero-amount shares.
 */

function phoneDigits(raw) {
  return String(raw || '').replace(/\D/g, '')
}

export function shareRowIsRemoved(s) {
  return !!(s?.removedAt || s?.removed_at)
}

export function shareRowIsActive(s) {
  return !shareRowIsRemoved(s)
}

export function bookingTotalForShares(booking) {
  if (!booking) return 0
  const db = parseFloat(booking.totalAmount ?? booking.total_amount)
  if (Number.isFinite(db) && db > 0.009) return Math.round(db * 100) / 100
  const p = parseFloat(booking.price)
  if (Number.isFinite(p) && p > 0.009) return Math.round(p * 100) / 100
  const a = parseFloat(booking.amount)
  if (Number.isFinite(a) && a > 0.009) return Math.round(a * 100) / 100
  return 0
}

/**
 * @param {object} booking
 * @param {object} share — one row from booking.paymentShares
 * @returns {number}
 */
export function effectiveShareAmount(booking, share) {
  if (!share) return 0
  if (shareRowIsRemoved(share)) return Math.round((parseFloat(share.amount) || 0) * 100) / 100

  const direct = parseFloat(share.amount)
  if (Number.isFinite(direct) && direct > 0.009) return Math.round(direct * 100) / 100

  const allShares = Array.isArray(booking?.paymentShares) ? booking.paymentShares : []
  const active = allShares.filter(shareRowIsActive)
  const zeros = active.filter((s) => (parseFloat(s.amount) || 0) <= 0.009)
  if (zeros.length === 0) return 0

  const total = bookingTotalForShares(booking)
  if (total <= 0.009) return 0

  const allocated = active.reduce((sum, s) => {
    const v = parseFloat(s.amount)
    return sum + (Number.isFinite(v) && v > 0.009 ? v : 0)
  }, 0)

  const remainder = Math.max(0, Math.round((total - allocated) * 100) / 100)
  if (remainder <= 0.009) return 0

  const each = Math.round((remainder / zeros.length) * 100) / 100
  return each
}

/** Match a tournament pending guest chip to a payment share row */
export function findPaymentShareForPendingGuest(booking, guestChip) {
  const shares = Array.isArray(booking?.paymentShares) ? booking.paymentShares : []
  const gd = phoneDigits(guestChip?.phoneDisplay || '')
  const tok = guestChip?.inviteToken != null ? String(guestChip.inviteToken).trim() : ''
  const fromId = String(guestChip?.id || '').startsWith('share-')
    ? String(guestChip.id).replace(/^share-/, '')
    : ''

  return (
    shares.find((s) => {
      if (shareRowIsRemoved(s)) return false
      if (fromId && String(s.id) === fromId) return true
      const st = (s.inviteToken || s.invite_token || '').toString().trim()
      if (tok && st && st === tok) return true
      const sd = phoneDigits(s.phone)
      if (gd.length >= 8 && sd === gd) return true
      return false
    }) || null
  )
}

export function effectivePendingGuestFee(booking, guestChip) {
  if (!guestChip) return 0
  const sh = booking ? findPaymentShareForPendingGuest(booking, guestChip) : null
  if (sh && booking) return effectiveShareAmount(booking, sh)
  return Math.round((parseFloat(guestChip.fee) || 0) * 100) / 100
}
