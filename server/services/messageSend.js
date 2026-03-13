/**
 * Platform message sending - uses SMS, WhatsApp, and/or Email based on platform_message_channels.
 */
import { getSetting } from '../db/dataHelpers.js'
import { sendWhatsAppText } from './whatsappSend.js'
import { sendSmsText } from './smsSend.js'

const PLATFORM_MESSAGE_CHANNELS_KEY = 'platform_message_channels'

/**
 * Get enabled channels. Returns { sms, whatsapp, email }.
 * Backward compat: if old platform_message_type exists, maps to channels.
 */
export async function getEnabledChannels() {
  try {
    const channels = await getSetting(PLATFORM_MESSAGE_CHANNELS_KEY)
    if (channels && typeof channels === 'object' && !Array.isArray(channels)) {
      return {
        sms: !!channels.sms,
        whatsapp: channels.whatsapp !== false,
        email: !!channels.email
      }
    }
    const legacy = await getSetting('platform_message_type')
    if (typeof legacy === 'string') {
      const v = String(legacy).trim().toLowerCase()
      if (v === 'sms') return { sms: true, whatsapp: false, email: false }
      if (v === 'whatsapp') return { sms: false, whatsapp: true, email: false }
    }
  } catch (e) {
    console.warn('[messageSend] getEnabledChannels failed:', e?.message)
  }
  return { sms: false, whatsapp: true, email: false }
}

/** Check if email channel is enabled */
export async function isEmailChannelEnabled() {
  const ch = await getEnabledChannels()
  return !!ch.email
}

/**
 * Send platform message (registration welcome, club welcome, booking confirm) via SMS and/or WhatsApp.
 * Sends to all enabled phone channels.
 * @param {string} toPhone - Recipient phone
 * @param {string} text - Message body
 * @returns {Promise<{ ok: boolean, messageId?: string, error?: string }>}
 */
export async function sendPlatformMessage(toPhone, text) {
  const ch = await getEnabledChannels()
  const results = []

  if (ch.sms) {
    const r = await sendSmsText(toPhone, text)
    results.push({ channel: 'sms', ...r })
  }
  if (ch.whatsapp) {
    const r = await sendWhatsAppText(toPhone, text)
    results.push({ channel: 'whatsapp', ...r })
  }

  if (results.length === 0) {
    return { ok: false, error: 'No phone channels enabled' }
  }
  const ok = results.some(r => r.ok)
  const lastOk = results.find(r => r.ok)
  return {
    ok,
    messageId: lastOk?.messageId,
    error: ok ? undefined : (results.map(r => r.error).filter(Boolean).join('; ') || 'Send failed')
  }
}
