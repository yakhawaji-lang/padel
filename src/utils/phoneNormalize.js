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

const ARABIC_INDIC_ZERO = 0x0660
const EXT_ARABIC_ZERO = 0x06f0

/** Arabic-Indic / Persian digits + bidi marks → Latin; then callers strip non-digits. */
export function toAsciiPhoneDigits(s) {
  if (s == null || s === '') return ''
  let t = String(s)
  try {
    t = t.normalize('NFKC')
  } catch {
    /* ignore */
  }
  t = t.replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, '')
  let out = ''
  for (let i = 0; i < t.length; i++) {
    const c = t.charCodeAt(i)
    if (c >= ARABIC_INDIC_ZERO && c <= ARABIC_INDIC_ZERO + 9) {
      out += String(c - ARABIC_INDIC_ZERO)
    } else if (c >= EXT_ARABIC_ZERO && c <= EXT_ARABIC_ZERO + 9) {
      out += String(c - EXT_ARABIC_ZERO)
    } else {
      out += t[i]
    }
  }
  return out
}

export function phoneDigitsNormalized(s) {
  return phoneDigits(toAsciiPhoneDigits(s))
}

/**
 * Map a picked / pasted international number into country code + national digits
 * for UI fields (e.g. My Favorites search).
 */
export function splitPickedPhoneToCountryAndNational(raw) {
  let digits = phoneDigitsNormalized(raw)
  while (digits.startsWith('00')) {
    digits = digits.slice(2)
  }
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
