/**
 * WhatsApp Webhook - for local Express server
 * Mirrors api/whatsapp-webhook.js for development
 */
import { Router } from 'express'

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

export default router
