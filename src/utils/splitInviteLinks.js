/**
 * Absolute pay-invite / pay-share URLs and WhatsApp deep links for split participants.
 */
import { normalizePhone } from './phoneNormalize'
import { buildPaymentShareWhatsAppPlainText } from './sharePaymentInviteMessage'

export function getAppBasePathForPayLinks() {
  if (typeof window === 'undefined') return ''
  const base = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || ''
  return base.replace(/\/$/, '') || ''
}

/** Full URL to open pay-invite or pay-share in the app / web */
export function buildPayShareAbsoluteUrl(inviteToken, participantType) {
  if (!inviteToken || typeof window === 'undefined') return ''
  const basePath = getAppBasePathForPayLinks()
  const path = String(participantType || '').toLowerCase() === 'unregistered' ? 'pay-invite' : 'pay-share'
  const prefix = basePath ? `${basePath}/` : '/'
  return `${window.location.origin}${prefix}${path}/${inviteToken}`
}

export function buildClubPublicAbsoluteUrl(clubId) {
  if (!clubId || typeof window === 'undefined') return ''
  const basePath = getAppBasePathForPayLinks()
  const prefix = basePath ? `${basePath}/` : '/'
  return `${window.location.origin}${prefix}clubs/${encodeURIComponent(String(clubId))}`
}

/**
 * WhatsApp to a specific number with bilingual invite + booking details + club link.
 * @param {string} phone
 * @param {string} payAbsoluteUrl — full https URL (/pay-invite/... or /pay-share/...)
 * @param {'en'|'ar'} language — UI language (message is always bilingual)
 * @param {object} [detail] — optional context for richer message
 */
export function buildWhatsAppHrefForSplitInvite(phone, payAbsoluteUrl, language, detail = {}) {
  const p = normalizePhone(String(phone || ''))
  const digits = p.replace(/\D/g, '')
  const waBase = digits.length >= 8 ? (digits.startsWith('966') ? `966${digits.slice(3)}` : digits) : ''
  const participantType = detail.participantType ?? detail.type ?? 'unregistered'
  const isUnreg = String(participantType).toLowerCase() === 'unregistered'
  const msg = buildPaymentShareWhatsAppPlainText({
    clubName: detail.clubName || 'Club',
    bookingDate: detail.bookingDate || '—',
    startTime: detail.startTime || '—',
    endTime: detail.endTime || '',
    shareAmount: detail.shareAmount != null && detail.shareAmount !== '' ? detail.shareAmount : detail.amount,
    currency: detail.currency || 'SAR',
    paymentUrl: payAbsoluteUrl || '',
    clubPageUrl: detail.clubPageUrl || '',
    externalWebsite: detail.externalWebsite || detail.clubWebsite || '',
    mode: isUnreg ? 'pay_invite' : 'pay_share',
  })
  return waBase
    ? `https://wa.me/${waBase}?text=${encodeURIComponent(msg)}`
    : `https://wa.me/?text=${encodeURIComponent(msg)}`
}
