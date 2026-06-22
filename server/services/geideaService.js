/**
 * Geidea Checkout V2 - server-side session creation.
 *
 * Reference: https://docs.geidea.net/checkout/v2/direct-session
 *
 * Authentication (per Geidea Checkout V2 docs):
 *   - HTTP Basic: username = Public Key, password = API Password
 *   - signature (request BODY field) = base64(HMAC-SHA256(message, APIPassword))
 *     message = PublicKey + Amount + Currency + MerchantRefId + Timestamp
 *     Amount must be formatted with 2 decimals (e.g. "100.00")
 *     Timestamp is the exact same string sent in the body
 *
 * Endpoint (KSA environment):
 *   - https://api.ksamerchant.geidea.net/payment-intent/api/v2/direct/session
 *
 * Security:
 *   - The API Password is NEVER sent to the browser. This module only runs server-side.
 *   - The browser only receives the short-lived sessionId returned by Geidea.
 */
import crypto from 'crypto'
import { getPaymentGatewaysRaw } from '../db/paymentSettings.js'

// KSA environment. Both test and live KSA merchants use the same KSA host;
// the merchant credentials determine whether it is a test or live account.
// Ref: https://docs.geidea.net/docs/geidea-checkout-v2 ("KSA Environment: https://api.ksamerchant.geidea.net/")
const GEIDEA_KSA_ENDPOINT = 'https://api.ksamerchant.geidea.net/payment-intent/api/v2/direct/session'

function pickEndpoint(mode) {
  const override = (process.env.GEIDEA_ENDPOINT_OVERRIDE || '').trim()
  if (override) return override
  void mode
  return GEIDEA_KSA_ENDPOINT
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

  // callbackUrl is mandatory in Geidea Checkout V2 and must be https://
  const effectiveCallbackUrl = callbackUrl || creds.callbackUrl
  if (!effectiveCallbackUrl || !/^https:\/\//i.test(effectiveCallbackUrl)) {
    const err = new Error('A valid https callbackUrl is required for Geidea V2')
    err.code = 'GEIDEA_CALLBACK_REQUIRED'
    throw err
  }

  const amountStr = formatAmount(amount)
  const timestamp = nowTimestamp()
  const signature = buildGeideaSignature({
    publicKey: creds.publicKey,
    apiPassword: creds.apiPassword,
    amount: amountStr,
    currency,
    merchantRefId,
    timestamp
  })

  // Per V2 docs, the signature is a BODY field (not a header). Amount is a
  // numeric value with 2 decimals; the same timestamp string is reused here.
  const body = {
    amount: Number(amountStr),
    currency,
    merchantReferenceId: merchantRefId,
    timestamp,
    signature,
    callbackUrl: effectiveCallbackUrl,
    paymentOperation: 'Pay',
    language: 'ar'
  }
  if (returnUrl) body.returnUrl = returnUrl
  if (customer) body.customer = customer

  // Authentication: HTTP Basic with public key as username, API password as password.
  const basic = Buffer.from(creds.publicKey + ':' + creds.apiPassword).toString('base64')
  const headers = {
    'Content-Type': 'application/json',
    Authorization: 'Basic ' + basic
  }

  const endpoint = pickEndpoint(creds.mode)
  let resp
  let json = null
  try {
    resp = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(body) })
  } catch (e) {
    const err = new Error('Geidea network error: ' + (e && e.message || e))
    err.code = 'GEIDEA_NETWORK_ERROR'
    throw err
  }
  try { json = await resp.json() } catch (_) {}

  const ok = resp.ok && json && json.session && json.session.id &&
    (json.responseCode === '000' || json.responseCode == null)
  if (!ok) {
    try {
      console.warn('[geidea] session request failed', JSON.stringify({
        status: resp.status,
        sentAmount: Number(amountStr),
        sentCurrency: currency,
        sentMerchantRef: merchantRefId,
        sentTimestamp: timestamp,
        sentSignaturePrefix: signature.substring(0, 10) + '...',
        sentEndpoint: endpoint,
        merchantPublicKeyPrefix: creds.publicKey.substring(0, 8) + '...',
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
