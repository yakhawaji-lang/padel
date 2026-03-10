/**
 * Send SMS via Authentica (Saudi Arabia).
 * API: https://api.authentica.sa/api/v2/send-sms
 * Requires AUTHENTICA_API_KEY. Optional: AUTHENTICA_SENDER_NAME (default: PlayTix).
 */

const AUTHENTICA_API_BASE = 'https://api.authentica.sa/api/v2'

/** Default country code when user enters local number (e.g. 05xxxxxxxx). */
const DEFAULT_COUNTRY_CODE = (process.env.WHATSAPP_DEFAULT_COUNTRY_CODE || '966').replace(/\D/g, '') || '966'

/** Sender name - must be registered with Authentica. */
const SENDER_NAME = (process.env.AUTHENTICA_SENDER_NAME || process.env.WHATSAPP_SENDER_NAME || 'PlayTix').trim()

function toE164WithPlus(phone) {
  if (phone == null || typeof phone !== 'string') return null
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 9) return null
  let normalized = digits.startsWith('0') ? digits.slice(1) : digits
  if (normalized.length === 9 && normalized.startsWith('5') && DEFAULT_COUNTRY_CODE) {
    normalized = DEFAULT_COUNTRY_CODE + normalized
  }
  return normalized ? `+${normalized}` : null
}

function withSenderSignature(text) {
  if (!text || typeof text !== 'string') return text
  const sig = SENDER_NAME ? `\n\n— ${SENDER_NAME}` : ''
  return text.trimEnd() + sig
}

export function isAuthenticaConfigured() {
  return !!process.env.AUTHENTICA_API_KEY?.trim()
}

/**
 * Send SMS via Authentica API.
 * @param {string} toPhone - Recipient phone (with or without +, spaces, etc.)
 * @param {string} text - Message body
 * @returns {Promise<{ ok: boolean, messageId?: string, error?: string }>}
 */
export async function sendAuthenticaSms(toPhone, text) {
  const apiKey = process.env.AUTHENTICA_API_KEY?.trim()
  if (!apiKey) {
    return { ok: false, error: 'Authentica not configured (AUTHENTICA_API_KEY)' }
  }

  const phone = toE164WithPlus(toPhone)
  if (!phone) return { ok: false, error: 'Invalid phone number' }
  if (!text || typeof text !== 'string') return { ok: false, error: 'Message text required' }

  const message = withSenderSignature(text)
  const url = `${AUTHENTICA_API_BASE}/send-sms`

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Authorization': apiKey
      },
      body: JSON.stringify({
        phone,
        message,
        sender_name: SENDER_NAME
      })
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      const errMsg = data?.errors?.[0]?.message || data?.message || `HTTP ${res.status}`
      console.error('[SMS Authentica]', res.status, errMsg, data)
      return { ok: false, error: errMsg }
    }
    if (data.success) {
      console.log('[SMS Authentica] sent to=', phone)
      return { ok: true, messageId: `auth-${Date.now()}` }
    }
    return { ok: false, error: data?.message || 'Send failed' }
  } catch (e) {
    console.error('[SMS Authentica]', e.message)
    return { ok: false, error: e.message }
  }
}
