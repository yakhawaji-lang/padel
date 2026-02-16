/**
 * Send WhatsApp text messages via Meta Cloud API.
 * Uses WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID from env (e.g. on Hostinger .env).
 * If either is missing, send is skipped (no error thrown).
 */

const GRAPH_BASE = 'https://graph.facebook.com/v18.0'

/** Normalize phone to E.164 digits only (no +). WhatsApp expects recipient number like 966501234567 */
function toE164Digits(phone) {
  if (phone == null || typeof phone !== 'string') return null
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 9) return null
  // If starts with 0, assume local; caller can pass country code. Otherwise use as-is.
  const normalized = digits.startsWith('0') ? digits.slice(1) : digits
  return normalized || null
}

/**
 * Send a text message to a WhatsApp number.
 * @param {string} toPhone - Recipient phone (with or without +, spaces, etc.)
 * @param {string} text - Message body
 * @returns {Promise<{ ok: boolean, messageId?: string, error?: string }>}
 */
export async function sendWhatsAppText(toPhone, text) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  if (!token || !phoneNumberId) {
    return { ok: false, error: 'WhatsApp not configured (missing WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID)' }
  }
  const to = toE164Digits(toPhone)
  if (!to) {
    return { ok: false, error: 'Invalid phone number' }
  }
  if (!text || typeof text !== 'string') {
    return { ok: false, error: 'Message text required' }
  }

  const url = `${GRAPH_BASE}/${phoneNumberId}/messages`
  const body = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    text: { body: text }
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      const errMsg = data?.error?.message || data?.error?.error_user_msg || `HTTP ${res.status}`
      console.error('[WhatsApp send]', res.status, errMsg, data)
      return { ok: false, error: errMsg }
    }
    const messageId = data?.messages?.[0]?.id
    return { ok: true, messageId }
  } catch (e) {
    console.error('[WhatsApp send]', e.message)
    return { ok: false, error: e.message }
  }
}
