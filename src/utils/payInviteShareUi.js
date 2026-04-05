/**
 * Shared UI rules for /pay-invite and /pay-share (profile banner + when payment actions show).
 */

export function shouldShowProfileIncompleteBanner(member) {
  if (!member?.profileIncomplete) return false
  const phoneDigits = String(member.mobile || member.phone || '').replace(/\D/g, '')
  const hasPhone = phoneDigits.length >= 8
  const hasName = !!(member.name && String(member.name).trim())
  const hasEmail = !!(member.email && String(member.email).includes('@'))
  if (hasPhone && hasName && hasEmail) return false
  return true
}

/**
 * Show pay-at-club / wallet / electronic when this share still expects payment.
 * Includes pending_payment and unpaid share with positive amount even if booking status was advanced incorrectly.
 */
export function inviteShareShowsPaymentActions(data) {
  if (!data || data.paidAt) return false
  const st = String(data.bookingStatus || '').toLowerCase().trim()
  if (['cancelled', 'canceled', 'rejected', 'expired'].includes(st)) return false
  const amt = parseFloat(data.amount)
  const hasPositiveShare = Number.isFinite(amt) && amt > 0.001
  const openSplitStatuses = ['pending_payments', 'partially_paid', 'pending_payment', 'locked', 'initiated']
  if (hasPositiveShare) return true
  return openSplitStatuses.includes(st)
}
