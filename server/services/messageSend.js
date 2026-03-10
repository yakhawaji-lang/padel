/**
 * Platform message sending - uses SMS or WhatsApp based on platform_message_type setting.
 */
import { query } from '../db/pool.js'
import { sendWhatsAppText } from './whatsappSend.js'
import { sendSmsText } from './smsSend.js'

const PLATFORM_MESSAGE_TYPE_KEY = 'platform_message_type'

async function getMessageChannel() {
  try {
    const { rows } = await query('SELECT value FROM app_store WHERE `key` = ?', [PLATFORM_MESSAGE_TYPE_KEY])
    if (rows?.length && rows[0].value != null) {
      let v = rows[0].value
      if (typeof v === 'string' && v.startsWith('"')) {
        try { v = JSON.parse(v) } catch { /* keep as is */ }
      }
      if (typeof v === 'object' && v !== null) v = v.channel ?? v.type ?? v
      v = String(v || '').trim().toLowerCase()
      if (v === 'sms') return 'sms'
      if (v === 'whatsapp') return 'whatsapp'
    }
  } catch (e) {
    console.warn('[messageSend] getMessageChannel failed:', e?.message)
  }
  return 'whatsapp' // default
}

/**
 * Send platform message (registration welcome, club welcome, booking confirm) via SMS or WhatsApp.
 * @param {string} toPhone - Recipient phone
 * @param {string} text - Message body
 * @returns {Promise<{ ok: boolean, messageId?: string, error?: string }>}
 */
export async function sendPlatformMessage(toPhone, text) {
  const channel = await getMessageChannel()
  if (channel === 'sms') {
    return sendSmsText(toPhone, text)
  }
  return sendWhatsAppText(toPhone, text)
}
