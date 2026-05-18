/**
 * Geidea Checkout V2 routes.
 *
 *  GET  /api/payments/geidea/config      -> public config (no secrets)
 *  POST /api/payments/geidea/session     -> create checkout session for a booking
 *  POST /api/payments/geidea/callback    -> Geidea server-to-server callback
 *
 * The browser only ever sees the public key + session id. The API password
 * stays on the server.
 */
import { Router } from 'express'
import crypto from 'crypto'
import rateLimit from 'express-rate-limit'
import { createGeideaSession, getGeideaPublicConfig } from '../services/geideaService.js'
import { query } from '../db/pool.js'

const router = Router()

const sessionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false
})

/** Public, non-secret config so the frontend can know which checkout to load. */
router.get('/config', async (req, res) => {
  try {
    const cfg = await getGeideaPublicConfig()
    res.json(cfg)
  } catch (e) {
    res.status(500).json({ error: (e && e.message) || 'config_error' })
  }
})

/**
 * Create a session for a booking.
 * Body: { bookingId, returnUrl?, callbackUrl?, customer? }
 * Returns: { sessionId, publicKey, merchantRefId, amount, currency, mode }
 */
router.post('/session', sessionLimiter, async (req, res) => {
  const body = req.body || {}
  const bookingId = body.bookingId
  const returnUrl = body.returnUrl
  const callbackUrl = body.callbackUrl
  const customer = body.customer
  const amountOverride = body.amount

  if (!bookingId && amountOverride == null) {
    return res.status(400).json({ error: 'bookingId or amount required' })
  }

  let amount = amountOverride
  let currency = 'SAR'
  let merchantRefId

  // bookingId may be:
  //   - numeric DB id (e.g. 12345)  -> look up in club_bookings
  //   - string localStorage id (e.g. 'bk_1779...')  -> skip DB lookup, require amount from client
  const isNumericBookingId = bookingId != null && /^[0-9]+$/.test(String(bookingId))
  if (isNumericBookingId) {
    try {
      const result = await query(
        'SELECT cb.id, cb.club_id, ' +
        '       COALESCE(cb.total_amount, 0) AS total_amount, ' +
        '       COALESCE(cb.paid_amount, 0)  AS paid_amount, ' +
        "       COALESCE(cs.currency, 'SAR') AS currency " +
        '  FROM club_bookings cb ' +
        '  LEFT JOIN club_settings cs ON cs.club_id = cb.club_id ' +
        ' WHERE cb.id = ? AND cb.deleted_at IS NULL ' +
        ' LIMIT 1',
        [Number(bookingId)]
      )
      const rows = result && result.rows
      const row = rows && rows[0]
      if (row) {
        const total = Number(row.total_amount) || 0
        const paid = Number(row.paid_amount) || 0
        const due = Math.max(0, total - paid)
        amount = Number(amountOverride) > 0 ? Number(amountOverride) : due
        currency = String(row.currency || 'SAR').trim() || 'SAR'
        const rawRef = 'BK' + String(row.id) + 'T' + Date.now().toString(36)
        merchantRefId = rawRef.substring(0, 40)
      }
    } catch (e) {
      console.warn('geidea /session lookup:', e && e.message)
      // continue to fallback path below
    }
  }
  // Fallback: string bookingId or numeric not found - use client-provided amount
  if (!merchantRefId) {
    if (!(Number(amount) > 0)) {
      return res.status(400).json({ error: 'amount_required_for_unsynced_booking', message: 'This booking is not synced to the server DB; client must provide amount.' })
    }
    const safeBookingId = String(bookingId || 'NA').replace(/[^a-zA-Z0-9]/g, '').substring(0, 20)
    merchantRefId = 'BK' + (safeBookingId || 'NA') + 'T' + Date.now().toString(36)
    merchantRefId = merchantRefId.substring(0, 40)
  }

  if (!(Number(amount) > 0)) {
    return res.status(400).json({ error: 'amount_must_be_positive' })
  }

  try {
    const result = await createGeideaSession({
      amount,
      currency,
      merchantRefId,
      returnUrl,
      callbackUrl,
      customer,
      metadata: bookingId ? { bookingId: String(bookingId) } : undefined
    })
    const publicCfg = await getGeideaPublicConfig()
    res.json(Object.assign({ ok: true }, result, { publicKey: publicCfg.publicKey }))
  } catch (e) {
    const code = (e && e.code) || 'GEIDEA_ERROR'
    const status = code === 'GEIDEA_NOT_CONFIGURED' || code === 'GEIDEA_DISABLED' ? 503 : 502
    const upstream = e && e.upstream ? {
      responseMessage: e.upstream.responseMessage,
      responseCode: e.upstream.responseCode,
      detailedResponseMessage: e.upstream.detailedResponseMessage,
      detailedResponseCode: e.upstream.detailedResponseCode,
    } : undefined
    res.status(status).json({ error: code, message: e && e.message, upstream })
  }
})

/**
 * Lightweight booking lookup for the HPP (configurePayment) flow.
 * Returns the booking's due amount, currency and a fresh merchantRefId.
 * Does NOT touch Geidea - the HPP script handles signing on Geidea's side.
 *
 * Body: { bookingId }
 * Returns: { amount, currency, merchantRefId, callbackUrl }
 */
router.post('/quote', async (req, res) => {
  try {
    const body = req.body || {}
    const bookingId = body.bookingId
    if (!bookingId) return res.status(400).json({ error: 'bookingId required' })
    const result = await query(
      'SELECT cb.id, ' +
      '       COALESCE(cb.total_amount, 0) AS total_amount, ' +
      '       COALESCE(cb.paid_amount, 0)  AS paid_amount, ' +
      "       COALESCE(cs.currency, 'SAR') AS currency " +
      '  FROM club_bookings cb ' +
      '  LEFT JOIN club_settings cs ON cs.club_id = cb.club_id ' +
      ' WHERE cb.id = ? AND cb.deleted_at IS NULL LIMIT 1',
      [bookingId]
    )
    const rows = result && result.rows
    const row = rows && rows[0]
    if (!row) return res.status(404).json({ error: 'booking_not_found' })
    const total = Number(row.total_amount) || 0
    const paid = Number(row.paid_amount) || 0
    const due = Math.max(0, total - paid)
    if (!(due > 0)) return res.status(400).json({ error: 'amount_must_be_positive' })
    const currency = String(row.currency || 'SAR').trim() || 'SAR'
    const rawRef = 'BK' + String(row.id).replace(/[^a-zA-Z0-9]/g, '') + 'T' + Date.now().toString(36)
    const merchantRefId = rawRef.substring(0, 40)
    const protocol = req.protocol || 'https'
    const host = req.get('host') || ''
    const callbackUrl = host ? (protocol + '://' + host + '/api/payments/geidea/callback') : undefined
    res.json({ ok: true, amount: due, currency, merchantRefId, callbackUrl })
  } catch (e) {
    console.warn('geidea /quote:', e && e.message)
    res.status(500).json({ error: 'quote_failed', message: e && e.message })
  }
})

/**
 * Geidea server-to-server callback. We log it and (when possible) advance
 * the associated booking. Production hardening should also verify X-Signature.
 */
router.post('/callback', async (req, res) => {
  try {
    const payload = req.body || {}
    const order = payload.order || {}
    const status = String(order.status || payload.status || '').toLowerCase()
    const merchantRef = order.merchantReferenceId || payload.merchantReferenceId
    let bookingId = null
    // New format: 'BK<bookingId>T<timestamp>' (no dashes between booking id and timestamp)
    // Old format: 'BK-<bookingId>-<timestamp>' (legacy, for backward compat)
    if (typeof merchantRef === 'string') {
      const m1 = merchantRef.match(/^BK([0-9]+)T[0-9a-z]+$/i)
      if (m1) bookingId = Number(m1[1])
      else if (merchantRef.indexOf('BK-') === 0) bookingId = Number(merchantRef.split('-')[1])
    }
    if (bookingId && (status === 'success' || status === 'paid' || status === 'captured')) {
      try {
        await query(
          "UPDATE club_bookings SET payment_status = 'paid', " +
          '       paid_amount = COALESCE(total_amount, paid_amount), ' +
          '       updated_at = NOW() ' +
          ' WHERE id = ? AND deleted_at IS NULL',
          [bookingId]
        )
      } catch (e) {
        console.warn('geidea /callback update booking:', e && e.message)
      }
    }
    res.json({ ok: true })
  } catch (e) {
    console.warn('geidea /callback:', e && e.message)
    res.json({ ok: true })
  }
})

export default router
