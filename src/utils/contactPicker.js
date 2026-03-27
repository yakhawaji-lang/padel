/**
 * Unified contact picking: Web Contact Picker API + Capacitor native pickContact.
 */
import { Capacitor } from '@capacitor/core'
import { normalizePhone, phoneDigits } from './phoneNormalize'

function isAbortError(e) {
  const name = e && (e.name || e.code)
  return name === 'AbortError' || name === 'NotAllowedError' || String(e?.message || '').toLowerCase().includes('abort')
}

/** Capacitor plugin reject (e.g. iOS contact picker closed without selection) */
function isNativeContactPickCancelled(e) {
  const code = String(e?.code || '')
  const msg = String(e?.message || '').toLowerCase()
  return code === 'CANCELLED' || msg.includes('cancel') || msg.includes('user cancelled')
}

function contactsAccessAllowed(perm) {
  const s = perm?.contacts
  return s === 'granted' || s === 'limited'
}

function dedupeNormalizedPhones(list) {
  const out = []
  const seen = new Set()
  for (const p of list) {
    const key = phoneDigits(p)
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(p)
  }
  return out
}

/**
 * True if the user can open a system contact chooser (mobile WebView or supported browser).
 */
export function isContactsPickSupported() {
  try {
    if (Capacitor.isNativePlatform()) return true
  } catch (_) {}
  return typeof navigator !== 'undefined' && 'contacts' in navigator && typeof navigator.contacts?.select === 'function'
}

/**
 * @param {object} opts
 * @param {boolean} [opts.multiple=false] - Web: multi-select when supported. Native: all tel numbers from one picked contact.
 * @param {number} [opts.max=20]
 * @returns {Promise<{ phones: string[], error?: string }>}
 */
export async function pickPhoneNumbersFromContacts({ multiple = false, max = 20 } = {}) {
  const cap = Math.max(1, Math.min(50, max || 20))
  const phones = []

  try {
    if (Capacitor.isNativePlatform()) {
      const { Contacts } = await import('@capacitor-community/contacts')
      const perm = await Contacts.requestPermissions()
      if (!contactsAccessAllowed(perm)) {
        return { phones: [], error: 'PERMISSION_DENIED' }
      }
      const { contact } = await Contacts.pickContact({
        projection: { phones: true, name: true },
      })
      for (const ph of contact?.phones || []) {
        const n = normalizePhone(String(ph?.number || ''))
        if (phoneDigits(n).length >= 8) phones.push(n)
      }
      const unique = dedupeNormalizedPhones(phones).slice(0, cap)
      return { phones: unique }
    }
  } catch (e) {
    if (isAbortError(e) || isNativeContactPickCancelled(e)) {
      return { phones: [], error: 'USER_CANCELLED' }
    }
    return { phones: [], error: 'NATIVE_PICK_FAILED' }
  }

  if (typeof navigator !== 'undefined' && typeof navigator.contacts?.select === 'function') {
    try {
      const selected = await navigator.contacts.select(['tel'], { multiple: Boolean(multiple) })
      for (const c of selected || []) {
        const tels = c.tel || []
        for (const tel of tels) {
          const n = normalizePhone(String(tel || ''))
          if (phoneDigits(n).length >= 8) phones.push(n)
        }
      }
      return { phones: dedupeNormalizedPhones(phones).slice(0, cap) }
    } catch (e) {
      if (isAbortError(e)) return { phones: [], error: 'USER_CANCELLED' }
      return { phones: [], error: 'WEB_PICK_FAILED' }
    }
  }

  return { phones: [], error: 'NOT_SUPPORTED' }
}
