/**
 * SMS Webhook - send test SMS via Twilio Messaging Service
 */
import { Router } from 'express'
import { sendSmsText } from '../services/smsSend.js'

const router = Router()

/** POST /api/sms-webhook/send - send a test SMS (for admin test page) */
router.post('/send', async (req, res) => {
  try {
    const { phone, text } = req.body || {}
    const phoneStr = typeof phone === 'string' ? phone.trim() : (phone != null ? String(phone) : '')
    const textStr = typeof text === 'string' ? text.trim() : (text != null ? String(text) : '')
    if (!phoneStr || !textStr) {
      return res.status(400).json({ error: 'phone and text are required' })
    }
    const result = await sendSmsText(phoneStr, textStr)
    if (!result.ok) {
      return res.status(400).json({ error: result.error || 'Send failed' })
    }
    return res.json({ ok: true, messageId: result.messageId })
  } catch (e) {
    console.error('[SMS send API]', e)
    return res.status(500).json({ error: e.message || 'Server error' })
  }
})

export default router
