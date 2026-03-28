/**
 * Absolute pay-invite / pay-share URLs and WhatsApp deep links for split participants.
 */
import { normalizePhone } from './phoneNormalize'

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

/**
 * WhatsApp to a specific number with payment link (preferred for guests).
 * @param {string} phone
 * @param {string} payAbsoluteUrl — full https URL to pay-invite or pay-share
 * @param {'en'|'ar'} language
 */
export function buildWhatsAppHrefForSplitInvite(phone, payAbsoluteUrl, language) {
  const p = normalizePhone(String(phone || ''))
  const digits = p.replace(/\D/g, '')
  const waBase = digits.length >= 8 ? (digits.startsWith('966') ? `966${digits.slice(3)}` : digits) : ''
  const msg =
    language === 'ar'
      ? `سجّل في PlayTix وادفع حصتك: ${payAbsoluteUrl}`
      : `Complete your share on PlayTix: ${payAbsoluteUrl}`
  return waBase
    ? `https://wa.me/${waBase}?text=${encodeURIComponent(msg)}`
    : `https://wa.me/?text=${encodeURIComponent(msg)}`
}
