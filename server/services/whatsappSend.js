/**
 * Send WhatsApp text messages via Twilio or Meta Cloud API.
 * Prefers Twilio when TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM are set.
 * Otherwise falls back to Meta (WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID).
 */

const GRAPH_BASE = 'https://graph.facebook.com/v21.0'
const TWILIO_API_BASE = 'https://api.twilio.com/2010-04-01'

/** Default country code when user enters local number (e.g. 05xxxxxxxx). Set WHATSAPP_DEFAULT_COUNTRY_CODE=966 for Saudi. */
const DEFAULT_COUNTRY_CODE = (process.env.WHATSAPP_DEFAULT_COUNTRY_CODE || '966').replace(/\D/g, '') || '966'

/** Sender name shown at end of messages (e.g. "— PlayTix"). Set WHATSAPP_SENDER_NAME to override. */
const SENDER_NAME = (process.env.WHATSAPP_SENDER_NAME || 'PlayTix').trim()

/** Normalize phone to E.164 digits only (no +). WhatsApp expects recipient number like 966501234567 */
function toE164Digits(phone) {
  if (phone == null || typeof phone !== 'string') return null
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 9) return null
  let normalized = digits.startsWith('0') ? digits.slice(1) : digits
  // If 9 digits and starts with 5 (e.g. Saudi mobile 5xxxxxxxx), prepend country code
  if (normalized.length === 9 && normalized.startsWith('5') && DEFAULT_COUNTRY_CODE) {
    normalized = DEFAULT_COUNTRY_CODE + normalized
  }
  return normalized || null
}

/** Check if Twilio is configured */
function isTwilioConfigured() {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_WHATSAPP_FROM
  return !!(sid && token && from)
}

/**
 * Send via Twilio WhatsApp API (free-form text, works within 24h customer service window).
 */
async function sendViaTwilio(toPhone, text) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  let from = process.env.TWILIO_WHATSAPP_FROM?.trim()
  if (!from?.startsWith('whatsapp:')) {
    from = from ? `whatsapp:${from.replace(/\D/g, '')}` : null
  }
  if (!accountSid || !authToken || !from) {
    return { ok: false, error: 'Twilio not configured (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM)' }
  }
  const to = toE164Digits(toPhone)
  if (!to) return { ok: false, error: 'Invalid phone number' }
  if (!text || typeof text !== 'string') return { ok: false, error: 'Message text required' }

  const toWa = `whatsapp:${to}`
  const url = `${TWILIO_API_BASE}/Accounts/${accountSid}/Messages.json`
  const params = new URLSearchParams()
  params.set('From', from)
  params.set('To', toWa)
  params.set('Body', text)

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
      // 63015 = recipient not in sandbox; 63016 = outside 24h window (need template)
      let hint = ''
      if (String(data?.code) === '63015') hint = ' — المستلم يجب أن يرسل "join direction-give" إلى Sandbox أولاً.'
      if (String(data?.code) === '63016') hint = ' — خارج نافذة 24 ساعة. أرسل رسالة من المستلم إلى الرقم أولاً، أو استخدم قالب معتمد.'
      console.error('[WhatsApp Twilio]', res.status, errMsg, data)
      return { ok: false, error: errMsg + hint }
    }
    const messageId = data?.sid
    if (messageId) console.log('[WhatsApp Twilio] sent sid=', messageId, 'to=', to)
    return { ok: true, messageId }
  } catch (e) {
    console.error('[WhatsApp Twilio]', e.message)
    return { ok: false, error: e.message }
  }
}

/**
 * Send via Meta Cloud API.
 */
async function sendViaMeta(toPhone, text) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  if (!token || !phoneNumberId) {
    return { ok: false, error: 'Meta WhatsApp not configured (WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID)' }
  }
  const to = toE164Digits(toPhone)
  if (!to) return { ok: false, error: 'Invalid phone number' }
  if (!text || typeof text !== 'string') return { ok: false, error: 'Message text required' }

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
      let errMsg = data?.error?.message || data?.error?.error_user_msg || `HTTP ${res.status}`
      if (/Object with ID .* does not exist|missing permissions|does not support this operation/i.test(errMsg)) {
        errMsg += ' — تأكد: 1) استخدام Phone number ID من WhatsApp → API Setup (وليس معرف الحساب WABA). 2) صلاحيات التوكن: whatsapp_business_messaging و business_management. 3) التوكن المؤقت ينتهي بعد 24 ساعة؛ أنشئ توكناً دائماً من System User.'
      }
      console.error('[WhatsApp Meta]', res.status, errMsg, data)
      return { ok: false, error: errMsg }
    }
    const messageId = data?.messages?.[0]?.id
    if (messageId) console.log('[WhatsApp Meta] accepted message_id=', messageId, 'to=', to)
    return { ok: true, messageId }
  } catch (e) {
    console.error('[WhatsApp Meta]', e.message)
    return { ok: false, error: e.message }
  }
}

/**
 * Send a text message to a WhatsApp number.
 * Uses Twilio if configured, otherwise Meta.
 * @param {string} toPhone - Recipient phone (with or without +, spaces, etc.)
 * @param {string} text - Message body
 * @returns {Promise<{ ok: boolean, messageId?: string, error?: string }>}
 */
/** Append sender signature so messages appear under PlayTix name */
function withSenderSignature(text) {
  if (!text || typeof text !== 'string') return text
  const sig = SENDER_NAME ? `\n\n— ${SENDER_NAME}` : ''
  return text.trimEnd() + sig
}

export async function sendWhatsAppText(toPhone, text) {
  const body = withSenderSignature(text)
  if (isTwilioConfigured()) {
    return sendViaTwilio(toPhone, body)
  }
  return sendViaMeta(toPhone, body)
}

/** Professional welcome message for new platform registration */
export function getRegistrationWelcomeMessage(name = '') {
  const greeting = name ? `مرحباً ${name.trim()}،` : 'مرحباً بك،'
  return `${greeting}

نرحب بانضمامك إلى منصة PlayTix لإدارة رياضة البادل. يمكنك الآن تصفح النوادي، حجز الملاعب، والمشاركة في البطولات والمنافسات.

نتمنى لك تجربة استثنائية على منصتنا!`
}

/** Professional welcome message when joining a club */
export function getClubWelcomeMessage(clubName) {
  const club = (clubName || 'النادي').toString().trim()
  return `مرحباً بك في نادي ${club}!

نرحب بانضمامك كعضو في النادي. يمكنك الآن حجز الملاعب، المشاركة في البطولات، والاستفادة من مزايا العضوية الحصرية.

نتمنى لك أوقاتاً ممتعة على الملاعب!`
}
