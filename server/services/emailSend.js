/**
 * Email sending - Resend or Twilio SendGrid
 * Uses platform_email_settings from app_settings (or env vars as fallback)
 */
import { getSetting } from '../db/dataHelpers.js'

const RESEND_API_URL = 'https://api.resend.com/emails'
const SENDGRID_API_URL = 'https://api.sendgrid.com/v3/mail/send'

async function getEmailConfig() {
  try {
    const stored = await getSetting('platform_email_settings')
    if (stored && typeof stored === 'object') {
      return {
        provider: (stored.provider || 'resend').toLowerCase(),
        from: stored.from || process.env.RESEND_FROM || 'PlayTix <noreply@playtix.app>',
        resendApiKey: stored.resendApiKey || process.env.RESEND_API_KEY,
        sendgridApiKey: stored.sendgridApiKey || process.env.SENDGRID_API_KEY
      }
    }
  } catch (e) {
    console.warn('[emailSend] getEmailConfig:', e?.message)
  }
  return {
    provider: process.env.SENDGRID_API_KEY ? 'sendgrid' : 'resend',
    from: process.env.RESEND_FROM || 'PlayTix <noreply@playtix.app>',
    resendApiKey: process.env.RESEND_API_KEY,
    sendgridApiKey: process.env.SENDGRID_API_KEY
  }
}

/**
 * Send email via Resend or SendGrid
 * @param {string} to - Recipient email
 * @param {string} subject - Subject
 * @param {string} html - HTML body
 * @param {string} [text] - Plain text fallback
 * @returns {Promise<{ ok: boolean, id?: string, error?: string }>}
 */
export async function sendEmail(to, subject, html, text) {
  const config = await getEmailConfig()
  const toStr = (to || '').trim().toLowerCase()
  if (!toStr || !toStr.includes('@')) {
    return { ok: false, error: 'Invalid recipient email' }
  }

  if (config.provider === 'sendgrid' && config.sendgridApiKey) {
    try {
      const res = await fetch(SENDGRID_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.sendgridApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: toStr }] }],
          from: parseFrom(config.from),
          subject,
          content: [
            ...(text ? [{ type: 'text/plain', value: text }] : []),
            { type: 'text/html', value: html || text || '' }
          ]
        })
      })
      if (!res.ok) {
        const errText = await res.text()
        let errJson = {}
        try { errJson = JSON.parse(errText) } catch (_) {}
        const msg = errJson?.errors?.[0]?.message || errText || 'SendGrid error'
        return { ok: false, error: msg }
      }
      const id = res.headers.get('x-message-id') || ''
      return { ok: true, id }
    } catch (e) {
      return { ok: false, error: e?.message || 'SendGrid failed' }
    }
  }

  if (config.resendApiKey) {
    try {
      const res = await fetch(RESEND_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.resendApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: config.from,
          to: toStr,
          subject,
          html: html || text || ''
        })
      })
      if (!res.ok) {
        const errText = await res.text()
        let errJson = {}
        try { errJson = JSON.parse(errText) } catch (_) {}
        const msg = errJson?.message || errText || 'Resend error'
        return { ok: false, error: msg }
      }
      const data = await res.json()
      return { ok: true, id: data?.id || '' }
    } catch (e) {
      return { ok: false, error: e?.message || 'Resend failed' }
    }
  }

  return { ok: false, error: 'Email service not configured. Add RESEND_API_KEY or SENDGRID_API_KEY.' }
}

function parseFrom(fromStr) {
  const m = (fromStr || '').match(/^(.+?)\s*<([^>]+)>$/)
  if (m) return { name: m[1].trim(), email: m[2].trim() }
  return { email: fromStr || 'noreply@playtix.app' }
}

/** Generate 4-digit verification code */
export function generateVerificationCode() {
  return String(Math.floor(1000 + Math.random() * 9000))
}
