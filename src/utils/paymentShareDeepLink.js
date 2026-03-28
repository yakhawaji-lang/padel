/**
 * Deep links for split-payment invites (/pay-invite/:token, /pay-share/:token).
 */

export function parsePaymentShareInviteToken(returnPath) {
  if (!returnPath || typeof returnPath !== 'string') return null
  const invite = returnPath.match(/^\/pay-invite\/([^/?#]+)/)
  if (invite) return decodeURIComponent(invite[1])
  const share = returnPath.match(/^\/pay-share\/([^/?#]+)/)
  if (share && share[1] !== 'booking') return decodeURIComponent(share[1])
  return null
}

/** Registration should use email verification + phone + profileIncomplete for these returns. */
export function isPaymentShareRegistrationReturn(returnPath) {
  if (!returnPath || typeof returnPath !== 'string') return false
  if (returnPath.startsWith('/pay-invite/')) return true
  return returnPath.startsWith('/pay-share/') && !returnPath.startsWith('/pay-share/booking')
}
