/**
 * Geidea Checkout V2 - server-side session creation.
 *
 * Reference: https://docs.geidea.net/checkout/v2/direct-session
 *
 * Authentication:
 *   - HTTP Basic: username = Public Key, password = API Password
 *   - Header: X-Signature = base64(HMAC-SHA256(message, APIPassword))
 *     message = PublicKey + Amount + Currency + MerchantRefId + Timestamp
 *     Amount must be the raw decimal string sent in body (e.g. "100.00")
 *     Timestamp must be ISO 8601 UTC (e.g. "2026-05-18T10:30:00")
 *
 * Endpoints:
 *   - KSA production: https://api.ksamerchant.geidea.net/payment-intent/api/v2/direct/session
 *
 * Security:
 *   - The API Password is NEVER sent to the browser. This module only runs server-side.
 *   - The browser only receives the short-lived sessionId returned by Geidea.
 */
import crypto from 'crypto'
import { getPaymentGatewaysRaw } from '../db/paymentSettings.js'

// Geidea has separate endpoints for TEST and LIVE credentials.
// TEST keys are rejected on the production URL (returns 'Invalid amount' or similar).
const GEIDEA_ENDPOINTS = {
  // KSA test environment.
  test: 'https://api-test.ksamerchant.geidea.net/payment-intent/api/v2/direct/session',
  // KSA production environment.
  live: 'https://api.ksamerchant.geidea.net/payment-intent/api/v2/direct/session'
}
// Fallback endpoint to try if the primary returns auth/amount errors (some merchants
// are provisioned on the cross-region test domain rather than ksa-specific).
const GEIDEA_TEST_FALLBACK = 'https://api.merchant.geidea.net/payment-intent/api/v2/direct/session'

function pickEndpoint(mode) {
  const override = (process.env.GEIDEA_ENDPOINT_OVERRIDE || '').trim()
  if (override) return override
  return GEIDEA_ENDPOINTS[mode] || GEIDEA_ENDPOINTS.live
}

/** Format amount the same way Geidea expects in the signature: "100.00" */
function formatAmount(amount) {
  const n = Number(amount)
  if (!Number.isFinite(n)) throw new Error('Invalid amount')
  return n.toFixed(2)
}

/** Build the HMAC-SHA256 signature (base64) for the direct/session request. */
export function buildGeideaSignature({ publicKey, apiPassword, amount, currency, merchantRefId, timestamp }) {
  const message = '' + publicKey + formatAmount(amount) + currency + merchantRefId + timestamp
  return crypto.createHmac('sha256', apiPassword).update(message, 'utf8').digest('base64')
}

/** ISO timestamp without milliseconds, used in signature + header. */
function nowTimestamp() {
  return new Date().toISOString().split('.')[0]
}

/** Read Geidea credentials from the DB (preferred) or environment fallback. */
async function loadCredentials() {
  const envPublic = (process.env.GEIDEA_PUBLIC_KEY || '').trim()
  const envPassword = (process.env.GEIDEA_API_PASSWORD || '').trim()
  const envEnabled = process.env.GEIDEA_ENABLED
  if (envPublic && envPassword) {
    return {
      publicKey: envPublic,
      apiPassword: envPassword,
      enabled: envEnabled !== '0' && envEnabled !== 'false',
      callbackUrl: (process.env.GEIDEA_CALLBACK_URL || '').trim() || null,
      mode: (process.env.GEIDEA_MODE || 'test').toLowerCase()
    }
  }
  try {
    const rows = await getPaymentGatewaysRaw()
    const row = (rows || []).find((r) => r.gateway_key === 'geidea')
    if (!row) return null
    let cfg = {}
    try {
      cfg = typeof row.config_json === 'string' ? JSON.parse(row.config_json || '{}') : (row.config_json || {})
    } catch (_) {}
    const publicKey = (cfg.publicKey || '').trim()
    const apiPassword = (cfg.apiPassword || '').trim()
    if (!publicKey || !apiPassword) return null
    return {
      publicKey,
      apiPassword,
      enabled: !!row.enabled,
      callbackUrl: (cfg.callbackUrl || '').trim() || null,
      mode: (cfg.mode || 'test').toLowerCase()
    }
  } catch (e) {
    console.warn('geideaService.loadCredentials:', e && e.message)
    return null
  }
}

/**
 * Create a Geidea direct session.
 * Returns { sessionId, merchantRefId, amount, currency, mode } on success.
 */
export async function createGeideaSession({ amount, currency = 'SAR', merchantRefId, callbackUrl, returnUrl, customer, metadata }) {
  const creds = await loadCredentials()
  if (!creds) {
    const err = new Error('Geidea is not configured')
    err.code = 'GEIDEA_NOT_CONFIGURED'
    throw err
  }
  if (!creds.enabled) {
    const err = new Error('Geidea gateway is disabled')
    err.code = 'GEIDEA_DISABLED'
    throw err
  }
  if (!merchantRefId) throw new Error('merchantRefId required')

  const timestamp = nowTimestamp()
  const amountStr = formatAmount(amount)
  const signature = buildGeideaSignature({
    publicKey: creds.publicKey,
    apiPassword: creds.apiPassword,
    amount: amountStr,
    currency,
    merchantRefId,
    timestamp
  })

  const body = {
    amount: Number(amountStr),
    currency,
    merchantReferenceId: merchantRefId,
    timestamp,
    paymentOperation: 'Pay',
    callbackUrl: callbackUrl || creds.callbackUrl || undefined,
    returnUrl: returnUrl || undefined,
    customer: customer || undefined,
    metadata: metadata || undefined
  }
  Object.keys(body).forEach((k) => body[k] === undefined && delete body[k])

  const basic = Buffer.from(creds.publicKey + ':' + creds.apiPassword).toString('base64')
  const headers = {
    'Content-Type': 'application/json',
    Authorization: 'Basic ' + basic,
    'X-Signature': signature,
    'X-Timestamp': timestamp
  }

  const primaryEndpoint = pickEndpoint(creds.mode)
  let resp
  let json = null
  let triedFallback = false
  async function callEndpoint(url) {
    try {
      return await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) })
    } catch (e) {
      const err = new Error('Geidea network error: ' + (e && e.message || e))
      err.code = 'GEIDEA_NETWORK_ERROR'
      throw err
    }
  }
  resp = await callEndpoint(primaryEndpoint)
  try { json = await resp.json() } catch (_) {}
  // Test-mode fallback: if KSA test endpoint says key invalid / amount invalid,
  // some accounts are actually provisioned on the cross-region test domain.
  const looksLikeWrongEnvironment = !resp.ok && json && (
    /invalid (amount|signature|key|merchant)/i.test(String(json.detailedResponseMessage || json.responseMessage || ''))
    || resp.status === 401 || resp.status === 403 || resp.status === 404
  )
  if (creds.mode === 'test' && looksLikeWrongEnvironment && primaryEndpoint !== GEIDEA_TEST_FALLBACK) {
    triedFallback = true
    console.warn('[geidea] primary test endpoint failed, retrying on fallback', { primary: primaryEndpoint, fallback: GEIDEA_TEST_FALLBACK, firstResponse: json })
    resp = await callEndpoint(GEIDEA_TEST_FALLBACK)
    json = null
    try { json = await resp.json() } catch (_) {}
  }
  void triedFallback

  if (!resp.ok || !json || !json.session || !json.session.id) {
    try {
      console.warn('[geidea] session request failed', JSON.stringify({
        status: resp.status,
        sentAmount: Number(amountStr),
        sentCurrency: currency,
        sentMerchantRef: merchantRefId,
        sentTimestamp: timestamp,
        upstream: json
      }))
    } catch (_) {}
    const err = new Error((json && (json.detailedResponseMessage || json.responseMessage)) || ('Geidea HTTP ' + resp.status))
    err.code = (json && (json.detailedResponseCode || json.responseCode)) || ('HTTP_' + resp.status)
    err.upstream = json
    throw err
  }

  return {
    sessionId: json.session.id,
    merchantRefId,
    amount: amountStr,
    currency,
    mode: creds.mode,
    expiryDate: json.session.expiryDate || null
  }
}

/** Public, non-secret info for the frontend to render the right UI. */
export async function getGeideaPublicConfig() {
  const creds = await loadCredentials()
  if (!creds) return { configured: false, enabled: false }
  return {
    configured: true,
    enabled: !!creds.enabled,
    mode: creds.mode,
    publicKey: creds.publicKey
  }
}
