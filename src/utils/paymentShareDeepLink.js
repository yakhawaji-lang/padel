/**
 * Deep links for split-payment invites (/pay-invite/:token, /pay-share/:token).
 */

const RESUME_INVITE_KEY = 'playtix_resume_invite_token'

/** Strip bidi/invisible chars and whitespace — common after pasting from WhatsApp */
export function normalizeInviteTokenParam(raw) {
  if (raw == null) return ''
  let s = String(raw).trim()
  try {
    s = decodeURIComponent(s)
  } catch (_) {}
  s = s.replace(/[\s\u200e\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g, '')
  if (!s) return ''
  s = s.replace(/^[<\[\('"„]+|[>\]\)'".,;:!?。]+$/g, '')
  const m = s.match(/inv_([a-f0-9]{32})/i)
  if (m) return `inv_${m[1].toLowerCase()}`
  const noFrag = s.split(/[?#]/)[0].replace(/\/+$/, '')
  return noFrag
}

/** True if the value normalizes to inv_ + 32 hex digits (server invite_token shape). */
export function isWellFormedInviteToken(raw) {
  const t = normalizeInviteTokenParam(raw)
  return /^inv_[a-f0-9]{32}$/.test(t)
}

/**
 * Turn returnTo query param into an app path (handles full https URLs and encoding).
 * Strips Vite BASE_URL (e.g. /app) when duplicated in plain paths so React Router basename matches.
 */
export function normalizePayReturnPath(rt) {
  if (!rt || typeof rt !== 'string') return ''
  const base = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/'
  const baseNorm = base.replace(/\/$/, '')
  let s = rt.trim().replace(/^@+/, '')
  try {
    s = decodeURIComponent(s)
  } catch (_) {}
  try {
    s = decodeURIComponent(s)
  } catch (_) {}
  if (/^https?:\/\//i.test(s)) {
    try {
      const u = new URL(s)
      const pathname = u.pathname || ''
      if (baseNorm && pathname.startsWith(baseNorm + '/')) {
        return pathname.slice(baseNorm.length) || '/'
      }
      if (baseNorm && pathname === baseNorm) return '/'
      return pathname.startsWith('/') ? pathname : `/${pathname}`
    } catch {
      return ''
    }
  }
  if (!s.startsWith('/')) s = `/${s}`
  if (baseNorm && s.startsWith(baseNorm + '/')) {
    s = s.slice(baseNorm.length) || '/'
  } else if (baseNorm && s === baseNorm) {
    s = '/'
  }
  return s
}

export function parsePaymentShareInviteToken(returnPath) {
  const p = normalizePayReturnPath(returnPath)
  if (!p) return null
  const invite = p.match(/\/pay-invite\/([^/?#]+)/)
  if (invite) return normalizeInviteTokenParam(invite[1])
  const share = p.match(/\/pay-share\/([^/?#]+)/)
  if (share && share[1] !== 'booking') return normalizeInviteTokenParam(share[1])
  return null
}

/** Registration uses email verification + phone; profile incomplete banner only if required fields are missing. */
export function isPaymentShareRegistrationReturn(returnPath) {
  const p = normalizePayReturnPath(returnPath)
  if (!p) return false
  if (p.startsWith('/pay-invite/')) return true
  return p.startsWith('/pay-share/') && !p.startsWith('/pay-share/booking')
}

export function persistResumeInviteToken(token) {
  const t = normalizeInviteTokenParam(token)
  if (!t) return
  if (typeof sessionStorage !== 'undefined') {
    try {
      sessionStorage.setItem(RESUME_INVITE_KEY, t)
    } catch (_) {}
  }
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(RESUME_INVITE_KEY, t)
    } catch (_) {}
  }
}

export function readResumeInviteToken() {
  const fromStore = (store) => {
    if (typeof store === 'undefined') return ''
    try {
      return normalizeInviteTokenParam(store.getItem(RESUME_INVITE_KEY) || '')
    } catch {
      return ''
    }
  }
  return fromStore(sessionStorage) || fromStore(localStorage)
}

export function clearResumeInviteToken() {
  if (typeof sessionStorage !== 'undefined') {
    try {
      sessionStorage.removeItem(RESUME_INVITE_KEY)
    } catch (_) {}
  }
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(RESUME_INVITE_KEY)
    } catch (_) {}
  }
}
