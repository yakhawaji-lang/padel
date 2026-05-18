/**
 * Geidea Checkout V2 - browser-side launcher.
 *
 *  - Lazy-loads https://www.ksamerchant.geidea.net/hpp/geideaCheckout.min.js
 *  - Asks the backend to create a session via POST /api/payments/geidea/session
 *  - Launches the Geidea popup using GeideaCheckout(sessionId)
 *
 * The card type (Mada / Visa / Mastercard) is detected automatically by Geidea;
 * the caller does NOT specify a payment method here.
 */

const SCRIPT_URL = 'https://www.ksamerchant.geidea.net/hpp/geideaCheckout.min.js'
let scriptPromise = null

function getApiBase() {
  if (typeof document === 'undefined') return ''
  const meta = document.querySelector('meta[name="playtix-api-base"]')
  const v = (meta && meta.getAttribute('content') || '').trim()
  return v.replace(/\/+$/, '')
}

/** Lazy-load the GeideaCheckout script tag. Idempotent. */
export function loadGeideaScript() {
  if (typeof window === 'undefined') return Promise.reject(new Error('No window'))
  if (window.GeideaCheckout) return Promise.resolve(window.GeideaCheckout)
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src="' + SCRIPT_URL + '"]')
    if (existing) {
      existing.addEventListener('load', () => resolve(window.GeideaCheckout))
      existing.addEventListener('error', () => reject(new Error('Failed to load Geidea script')))
      return
    }
    const s = document.createElement('script')
    s.src = SCRIPT_URL
    s.async = true
    s.onload = () => {
      if (window.GeideaCheckout) resolve(window.GeideaCheckout)
      else reject(new Error('GeideaCheckout not on window after load'))
    }
    s.onerror = () => {
      scriptPromise = null
      reject(new Error('Failed to load Geidea script'))
    }
    document.head.appendChild(s)
  })
  return scriptPromise
}

/** Ask backend for a Geidea sessionId for a booking. */
export async function createGeideaSessionForBooking({ bookingId, returnUrl, customer } = {}) {
  if (!bookingId) throw new Error('bookingId required')
  const base = getApiBase()
  const resp = await fetch(base + '/api/payments/geidea/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ bookingId, returnUrl, customer })
  })
  let json = null
  try { json = await resp.json() } catch (_) {}
  if (!resp.ok || !json || !json.sessionId) {
    const upstreamMsg = json && json.upstream && (json.upstream.detailedResponseMessage || json.upstream.responseMessage)
    const baseMsg = (json && (json.message || json.error)) || ('HTTP ' + resp.status)
    const err = new Error(upstreamMsg ? (baseMsg + ' - ' + upstreamMsg) : baseMsg)
    err.code = json && json.error
    err.upstream = json && json.upstream
    throw err
  }
  return json
}

/** Fetch public, non-secret Geidea config (used to decide whether to show the button). */
export async function getGeideaPublicConfig() {
  const base = getApiBase()
  try {
    const resp = await fetch(base + '/api/payments/geidea/config', { credentials: 'include' })
    if (!resp.ok) return { configured: false, enabled: false }
    return await resp.json()
  } catch (_) {
    return { configured: false, enabled: false }
  }
}

/**
 * Launch the Geidea checkout popup.
 * Returns Promise<{status, data}>
 */
export function launchGeideaCheckout({ sessionId, onSuccess, onError, onCancel } = {}) {
  return new Promise((resolve, reject) => {
    if (!sessionId) {
      reject(new Error('sessionId required'))
      return
    }
    const Ctor = typeof window !== 'undefined' ? window.GeideaCheckout : null
    if (!Ctor) {
      reject(new Error('GeideaCheckout not loaded'))
      return
    }
    const handler = (status, data) => {
      try {
        if (status === 'success') { onSuccess && onSuccess(data); resolve({ status, data }) }
        else if (status === 'error') { onError && onError(data); resolve({ status, data }) }
        else if (status === 'cancel') { onCancel && onCancel(data); resolve({ status, data }) }
        else resolve({ status, data })
      } catch (e) { reject(e) }
    }
    try {
      const checkout = new Ctor(
        (data) => handler('success', data),
        (data) => handler('error', data),
        (data) => handler('cancel', data)
      )
      checkout.startPayment(sessionId)
    } catch (e) {
      reject(e)
    }
  })
}

/** One-call helper: load script, create session, launch checkout. */
export async function payBookingWithGeidea({ bookingId, returnUrl, customer } = {}) {
  await loadGeideaScript()
  const session = await createGeideaSessionForBooking({ bookingId, returnUrl, customer })
  const result = await launchGeideaCheckout({ sessionId: session.sessionId })
  return Object.assign({}, result, { session })
}
