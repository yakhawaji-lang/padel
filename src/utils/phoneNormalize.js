/**
 * Shared phone normalization for booking, WhatsApp, and contact picking.
 */
import { COUNTRY_CODES } from './countryCodes'

export function normalizePhone(s) {
  if (s == null || typeof s !== 'string') return ''
  return s.replace(/\s/g, '').replace(/^00/, '+').replace(/^0/, '+966')
}

export function phoneDigits(s) {
  return (s || '').replace(/\D/g, '')
}

/**
 * Map a picked / pasted international number into country code + national digits
 * for UI fields (e.g. My Favorites search).
 */
export function splitPickedPhoneToCountryAndNational(raw) {
  const digits = phoneDigits(raw)
  if (!digits) return { countryCode: '966', national: '' }
  const sorted = [...COUNTRY_CODES].sort((a, b) => b.code.length - a.code.length)
  for (const c of sorted) {
    if (digits.startsWith(c.code) && digits.length > c.code.length) {
      return { countryCode: c.code, national: digits.slice(c.code.length).replace(/^0+/, '') }
    }
  }
  if (digits.length === 10 && digits.startsWith('0')) {
    return { countryCode: '966', national: digits.slice(1).replace(/^0+/, '') }
  }
  if (digits.length === 9 && digits.startsWith('5')) {
    return { countryCode: '966', national: digits }
  }
  if (digits.startsWith('966')) {
    return { countryCode: '966', national: digits.slice(3).replace(/^0+/, '') }
  }
  return { countryCode: '966', national: digits.replace(/^0+/, '') }
}
