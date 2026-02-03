/**
 * WhatsApp Business API Webhook
 * GET: Verification (Meta sends hub.mode, hub.challenge, hub.verify_token)
 * POST: Receive messages and status updates
 * @see https://developers.facebook.com/docs/whatsapp/cloud-api/guides/set-up-webhooks
 */
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'playtix_whatsapp_verify'

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return handleVerify(req, res)
  }
  if (req.method === 'POST') {
    return handleWebhook(req, res)
  }
  res.setHeader('Allow', 'GET, POST')
  return res.status(405).json({ error: 'Method not allowed' })
}

/** Meta verification - must return hub.challenge */
function handleVerify(req, res) {
  const mode = req.query?.['hub.mode']
  const token = req.query?.['hub.verify_token']
  const challenge = req.query?.['hub.challenge']

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    res.setHeader('Content-Type', 'text/plain')
    return res.status(200).send(challenge)
  }
  return res.status(403).json({ error: 'Verification failed' })
}

/** Process incoming webhook events */
async function handleWebhook(req, res) {
  // Must respond 200 immediately to acknowledge receipt
  res.status(200).end()

  const body = req.body
  if (!body || typeof body !== 'object') return

  if (body.object !== 'whatsapp_business_account') return

  const entries = body.entry || []
  for (const entry of entries) {
    const changes = entry.changes || []
    for (const change of changes) {
      const value = change.value
      if (!value) continue

      // Incoming messages
      if (value.messages) {
        for (const msg of value.messages) {
          try {
            await processIncomingMessage(msg, value.metadata)
          } catch (e) {
            console.error('WhatsApp webhook message error:', e)
          }
        }
      }

      // Message status updates (sent, delivered, read)
      if (value.statuses) {
        for (const status of value.statuses) {
          try {
            await processStatusUpdate(status)
          } catch (e) {
            console.error('WhatsApp webhook status error:', e)
          }
        }
      }
    }
  }
}

async function processIncomingMessage(msg, metadata) {
  const from = msg.from
  const type = msg.type
  const id = msg.id

  let text = ''
  if (type === 'text' && msg.text) text = msg.text.body
  if (type === 'button' && msg.button) text = msg.button.text

  console.log('[WhatsApp] Message from', from, 'type', type, ':', text?.slice(0, 80) || '(non-text)')

  // TODO: Add your logic here - e.g. auto-reply, save to DB, trigger flows
  // Example: if (text.toLowerCase().includes('مرحبا')) { await sendReply(from, 'أهلاً بك!') }
}

async function processStatusUpdate(status) {
  const id = status.id
  const recipient = status.recipient_id
  const statusType = status.status // sent, delivered, read, failed
  console.log('[WhatsApp] Status', statusType, 'for message', id)
}
