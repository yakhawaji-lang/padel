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

// Mode-aware script URL: Geidea hosts separate JS bundles for test vs production.
//   TEST       -> https://www.merchant.geidea.net/hpp/geideaCheckout.min.js
//   LIVE (KSA) -> https://www.ksamerchant.geidea.net/hpp/geideaCheckout.min.js
const SCRIPT_URLS = {
  test: 'https://www.merchant.geidea.net/hpp/geideaCheckout.min.js',
  live: 'https://www.ksamerchant.geidea.net/hpp/geideaCheckout.min.js'
}
function pickScriptUrl(mode) {
  return SCRIPT_URLS[mode] || SCRIPT_URLS.live
}
let scriptPromise = null
let loadedScriptMode = null

function getApiBase() {
  if (typeof document === 'undefined') return ''
  const meta = document.querySelector('meta[name="playtix-api-base"]')
  const v = (meta && meta.getAttribute('content') || '').trim()
  return v.replace(/\/+$/, '')
}

/** Lazy-load the GeideaCheckout script tag. Idempotent. Accepts mode ('test'|'live'). */
export function loadGeideaScript(mode) {
  if (typeof window === 'undefined') return Promise.reject(new Error('No window'))
  const scriptUrl = pickScriptUrl(mode)
  // If the loaded script is for a different mode, force a reload by clearing the promise.
  if (window.GeideaCheckout && loadedScriptMode === mode) return Promise.resolve(window.GeideaCheckout)
  if (scriptPromise && loadedScriptMode === mode) return scriptPromise
  loadedScriptMode = mode
  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src="' + scriptUrl + '"]')
    if (existing) {
      existing.addEventListener('load', () => resolve(window.GeideaCheckout))
      existing.addEventListener('error', () => reject(new Error('Failed to load Geidea script')))
      return
    }
    const s = document.createElement('script')
    s.src = scriptUrl
    s.async = true
    s.onload = () => {
      if (window.GeideaCheckout) resolve(window.GeideaCheckout)
      else reject(new Error('GeideaCheckout not on window after load'))
    }
    s.onerror = () => {
      scriptPromise = null
      loadedScriptMode = null
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

/**
 * HPP (Hosted Payment Page) flow - Geidea's JS handles signing on their side.
 * Returns Promise<{status, data}>.
 *
 * This is simpler than the direct-session flow: no HMAC signing on our backend,
 * no test/live endpoint juggling. The merchant public key is included in the
 * payment configuration (it's already public, this is by design).
 */
async function launchGeideaHpp({ amount, currency = 'SAR', merchantRefId, returnUrl, callbackUrl, customer, publicKey, mode }) {
  return new Promise((resolve, reject) => {
    const Ctor = typeof window !== 'undefined' ? window.GeideaCheckout : null
    if (!Ctor) { reject(new Error('GeideaCheckout not loaded')); return }
    let payment
    try {
      payment = new Ctor(
        (data) => resolve({ status: 'success', data }),
        (data) => resolve({ status: 'error', data }),
        (data) => resolve({ status: 'cancel', data })
      )
      const cfg = {
        amount: Number(amount),
        currency,
        merchantReferenceId: merchantRefId,
        merchantPublicKey: publicKey,
        callbackUrl: callbackUrl || undefined,
        returnUrl: returnUrl || undefined,
        customer: customer || undefined,
        paymentOperation: 'Pay',
        language: 'ar'
      }
      Object.keys(cfg).forEach((k) => cfg[k] === undefined && delete cfg[k])
      if (typeof payment.configurePayment === 'function') {
        payment.configurePayment(cfg)
        payment.startPayment()
      } else {
        // Older bundles only accept sessionId. Should not happen with v2 script.
        reject(new Error('GeideaCheckout.configurePayment unavailable'))
      }
      void mode
    } catch (e) {
      reject(e)
    }
  })
}

/** One-call helper:
 *  1. Ask backend for Geidea config (public key + mode) and booking amount
 *  2. Load matching Geidea script
 *  3. Launch HPP popup with configurePayment (no pre-signed session needed)
 */
export async function payBookingWithGeidea({ bookingId, returnUrl, customer } = {}) {
  const cfg = await getGeideaPublicConfig()
  if (!cfg.configured || !cfg.enabled) {
    const err = new Error('Geidea is not enabled')
    err.code = cfg.configured ? 'GEIDEA_DISABLED' : 'GEIDEA_NOT_CONFIGURED'
    throw err
  }
  // Resolve the booking amount via backend (still need this to know how much to charge)
  const base = getApiBase()
  const lookupResp = await fetch(base + '/api/payments/geidea/quote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ bookingId })
  })
  let quote = null
  try { quote = await lookupResp.json() } catch (_) {}
  if (!lookupResp.ok || !quote || !quote.amount) {
    // Fallback: try the legacy direct-session route in case the /quote endpoint isn't deployed yet.
    const session = await createGeideaSessionForBooking({ bookingId, returnUrl, customer })
    await loadGeideaScript(session.mode)
    const result = await launchGeideaCheckout({ sessionId: session.sessionId })
    return Object.assign({}, result, { session })
  }
  await loadGeideaScript(cfg.mode)
  const result = await launchGeideaHpp({
    amount: quote.amount,
    currency: quote.currency || 'SAR',
    merchantRefId: quote.merchantRefId || ('BK-' + bookingId + '-' + Date.now().toString(36)),
    publicKey: cfg.publicKey,
    callbackUrl: quote.callbackUrl,
    returnUrl,
    customer,
    mode: cfg.mode
  })
  return Object.assign({}, result, { quote })
}
