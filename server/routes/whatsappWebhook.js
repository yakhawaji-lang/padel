/**
 * WhatsApp Webhook - for local Express server
 * Mirrors api/whatsapp-webhook.js for development
 */
import { Router } from 'express'
import { sendWhatsAppText } from '../services/whatsappSend.js'

const router = Router()
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'playtix_whatsapp_verify'

router.get('/', (req, res) => {
  const mode = req.query?.['hub.mode']
  const token = req.query?.['hub.verify_token']
  const challenge = req.query?.['hub.challenge']
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    res.setHeader('Content-Type', 'text/plain')
    return res.status(200).send(challenge)
  }
  return res.status(403).json({ error: 'Verification failed' })
})

router.post('/', (req, res) => {
  res.status(200).end()
  const body = req.body
  if (!body || body.object !== 'whatsapp_business_account') return
  const entries = body.entry || []
  for (const entry of entries) {
    for (const change of entry.changes || []) {
      const value = change.value
      if (!value) continue
      if (value.messages) {
        value.messages.forEach(m => console.log('[WhatsApp] Message from', m.from, m.type))
      }
      if (value.statuses) {
        value.statuses.forEach(s => console.log('[WhatsApp] Status', s.status))
      }
    }
  }
})

/** POST /api/whatsapp-webhook/send - send a test WhatsApp text message (for admin test page) */
router.post('/send', async (req, res) => {
  try {
    const { phone, text } = req.body || {}
    const phoneStr = typeof phone === 'string' ? phone.trim() : (phone != null ? String(phone) : '')
    const textStr = typeof text === 'string' ? text.trim() : (text != null ? String(text) : '')
    if (!phoneStr || !textStr) {
      return res.status(400).json({ error: 'phone and text are required' })
    }
    const result = await sendWhatsAppText(phoneStr, textStr)
    if (!result.ok) {
      return res.status(400).json({ error: result.error || 'Send failed' })
    }
    return res.json({ ok: true, messageId: result.messageId })
  } catch (e) {
    console.error('[WhatsApp send API]', e)
    return res.status(500).json({ error: e.message || 'Server error' })
  }
})

export default router
