/**
 * Send SMS via Twilio or Authentica.
 * Authentica (Saudi): AUTHENTICA_API_KEY — preferred for Saudi numbers.
 * Twilio: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_MESSAGING_SERVICE_SID.
 */

import { sendAuthenticaSms, isAuthenticaConfigured } from './authenticaSend.js'

const TWILIO_API_BASE = 'https://api.twilio.com/2010-04-01'

/** Default country code when user enters local number (e.g. 05xxxxxxxx). */
const DEFAULT_COUNTRY_CODE = (process.env.WHATSAPP_DEFAULT_COUNTRY_CODE || '966').replace(/\D/g, '') || '966'

/** Sender name shown at end of messages (e.g. "— PlayTix"). */
const SENDER_NAME = (process.env.WHATSAPP_SENDER_NAME || 'PlayTix').trim()

function toE164Digits(phone) {
  if (phone == null || typeof phone !== 'string') return null
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 9) return null
  let normalized = digits.startsWith('0') ? digits.slice(1) : digits
  if (normalized.length === 9 && normalized.startsWith('5') && DEFAULT_COUNTRY_CODE) {
    normalized = DEFAULT_COUNTRY_CODE + normalized
  }
  return normalized || null
}

function isTwilioSmsConfigured() {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const messagingSid = process.env.TWILIO_MESSAGING_SERVICE_SID
  return !!(sid && token && messagingSid)
}

function isSmsConfigured() {
  return isAuthenticaConfigured() || isTwilioSmsConfigured()
}

function withSenderSignature(text) {
  if (!text || typeof text !== 'string') return text
  const sig = SENDER_NAME ? `\n\n— ${SENDER_NAME}` : ''
  return text.trimEnd() + sig
}

/**
 * Send SMS via Authentica (if configured) or Twilio.
 * Authentica is preferred when AUTHENTICA_API_KEY is set (better for Saudi Arabia).
 * @param {string} toPhone - Recipient phone (with or without +, spaces, etc.)
 * @param {string} text - Message body
 * @returns {Promise<{ ok: boolean, messageId?: string, error?: string }>}
 */
export async function sendSmsText(toPhone, text) {
  if (isAuthenticaConfigured()) {
    return sendAuthenticaSms(toPhone, text)
  }
  return sendViaTwilio(toPhone, text)
}

async function sendViaTwilio(toPhone, text) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID?.trim()

  if (!accountSid || !authToken || !messagingServiceSid) {
    return { ok: false, error: 'SMS not configured. Add AUTHENTICA_API_KEY (for Saudi) or Twilio credentials.' }
  }

  const to = toE164Digits(toPhone)
  if (!to) return { ok: false, error: 'Invalid phone number' }
  if (!text || typeof text !== 'string') return { ok: false, error: 'Message text required' }

  const body = withSenderSignature(text)
  const url = `${TWILIO_API_BASE}/Accounts/${accountSid}/Messages.json`
  const params = new URLSearchParams()
  params.set('MessagingServiceSid', messagingServiceSid)
  params.set('To', to)
  params.set('Body', body)

  try {
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64')
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${auth}`
      },
      body: params.toString()
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      const errMsg = data?.message || data?.error_message || `HTTP ${res.status}`
      console.error('[SMS Twilio]', res.status, errMsg, data)
      return { ok: false, error: errMsg }
    }
    const messageId = data?.sid
    if (messageId) console.log('[SMS Twilio] sent sid=', messageId, 'to=', to)
    return { ok: true, messageId }
  } catch (e) {
    console.error('[SMS Twilio]', e.message)
    return { ok: false, error: e.message }
  }
}

export { isSmsConfigured }
