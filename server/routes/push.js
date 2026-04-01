/**
 * Web Push — اشتراك مديري النوادي لاستقبال إشعارات حتى مع إغلاق التبويب.
 */
import { Router } from 'express'
import { createHash } from 'crypto'
import { query } from '../db/pool.js'
import { assertClubPushActor } from '../lib/clubPushAuth.js'

const router = Router()

function endpointHash(endpoint) {
  return createHash('sha256').update(String(endpoint || ''), 'utf8').digest('hex')
}

function getVapidPublicKey() {
  const k = process.env.VAPID_PUBLIC_KEY
  return k && String(k).trim() ? String(k).trim() : null
}

/** GET /api/push/vapid-public */
router.get('/vapid-public', (req, res) => {
  const publicKey = getVapidPublicKey()
  if (!publicKey) {
    return res.status(503).json({ ok: false, error: 'Web Push not configured (VAPID_PUBLIC_KEY)' })
  }
  res.json({ ok: true, publicKey })
})

/** POST /api/push/subscribe  Body: { clubId, subscription, locale?: 'ar'|'en' } */
router.post('/subscribe', async (req, res) => {
  try {
    const { clubId, subscription, locale } = req.body || {}
    const auth = await assertClubPushActor(req, clubId)
    if (!auth.ok) return res.status(auth.status || 403).json({ error: auth.error })

    const sub = subscription
    const endpoint = sub?.endpoint
    const p256dh = sub?.keys?.p256dh
    const authSecret = sub?.keys?.auth
    if (!endpoint || !p256dh || !authSecret) {
      return res.status(400).json({ error: 'Invalid subscription object' })
    }

    const eh = endpointHash(endpoint)
    const loc = String(locale || 'ar').toLowerCase().startsWith('en') ? 'en' : 'ar'

    await query(
      `INSERT INTO club_push_subscriptions 
        (endpoint_hash, endpoint, p256dh, auth_secret, club_id, admin_user_id, locale, last_push_fingerprint)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL)
       ON DUPLICATE KEY UPDATE
         endpoint = VALUES(endpoint),
         p256dh = VALUES(p256dh),
         auth_secret = VALUES(auth_secret),
         club_id = VALUES(club_id),
         admin_user_id = VALUES(admin_user_id),
         locale = VALUES(locale),
         updated_at = CURRENT_TIMESTAMP`,
      [eh, endpoint, p256dh, authSecret, String(clubId).trim(), auth.adminUserId || null, loc]
    )

    res.json({ ok: true })
  } catch (e) {
    console.error('[push/subscribe]', e)
    res.status(500).json({ error: e?.message || 'Subscribe failed' })
  }
})

/** POST /api/push/unsubscribe  Body: { endpoint } */
router.post('/unsubscribe', async (req, res) => {
  try {
    const { endpoint } = req.body || {}
    if (!endpoint) return res.status(400).json({ error: 'endpoint required' })

    const eh = endpointHash(endpoint)
    const { rows } = await query(
      'SELECT club_id FROM club_push_subscriptions WHERE endpoint_hash = ? LIMIT 1',
      [eh]
    )
    const row = rows?.[0]
    if (!row) return res.json({ ok: true })

    const auth = await assertClubPushActor(req, row.club_id)
    if (!auth.ok) return res.status(auth.status || 403).json({ error: auth.error })

    await query('DELETE FROM club_push_subscriptions WHERE endpoint_hash = ?', [eh])
    res.json({ ok: true })
  } catch (e) {
    console.error('[push/unsubscribe]', e)
    res.status(500).json({ error: e?.message || 'Unsubscribe failed' })
  }
})

/** POST /api/push/foreground  Body: { endpoint } — يحدّث آخر ظهور للتبويب لتفادي إشعار Push مكرر والمستخدم ينظر للصفحة */
router.post('/foreground', async (req, res) => {
  try {
    const { endpoint } = req.body || {}
    if (!endpoint) return res.status(400).json({ error: 'endpoint required' })

    const eh = endpointHash(endpoint)
    const { rows } = await query(
      'SELECT club_id FROM club_push_subscriptions WHERE endpoint_hash = ? LIMIT 1',
      [eh]
    )
    const row = rows?.[0]
    if (!row) return res.json({ ok: true })

    const auth = await assertClubPushActor(req, row.club_id)
    if (!auth.ok) return res.status(auth.status || 403).json({ error: auth.error })

    await query(
      'UPDATE club_push_subscriptions SET last_foreground_ping_at = NOW() WHERE endpoint_hash = ?',
      [eh]
    )
    res.json({ ok: true })
  } catch (e) {
    console.error('[push/foreground]', e)
    res.status(500).json({ error: e?.message || 'Foreground ping failed' })
  }
})

export default router
