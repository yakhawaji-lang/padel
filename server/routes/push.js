/**
 * Web Push — اشتراك مديري النوادي لاستقبال إشعارات حتى مع إغلاق التبويب.
 */
import { existsSync } from 'fs'
import { Router } from 'express'
import { createHash } from 'crypto'
import { dirname, join, resolve } from 'path'
import { fileURLToPath } from 'url'
import { query } from '../db/pool.js'
import { assertClubPushActor } from '../lib/clubPushAuth.js'

const router = Router()

/** dist/sw.js بعد npm run build — يُقدَّم هنا حتى لا يعترضه Apache SPA ويُرجع text/html */
const SW_DIST_FILE = resolve(join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'dist', 'sw.js'))

function endpointHash(endpoint) {
  return createHash('sha256').update(String(endpoint || ''), 'utf8').digest('hex')
}

function getVapidPublicKey() {
  const k = process.env.VAPID_PUBLIC_KEY
  return k && String(k).trim() ? String(k).trim() : null
}

/** GET /api/push/health — تشخيص سريع: هل VAPID مضبوط؟ هل يوجد اشتراكات؟ */
router.get('/health', async (req, res) => {
  try {
    const pub = !!process.env.VAPID_PUBLIC_KEY?.trim()
    const priv = !!process.env.VAPID_PRIVATE_KEY?.trim()
    let subscriptionRows = -1
    try {
      const { rows } = await query('SELECT COUNT(*) AS c FROM club_push_subscriptions', [])
      subscriptionRows = Number(rows?.[0]?.c ?? 0) || 0
    } catch {
      subscriptionRows = -1
    }
    res.json({
      ok: true,
      vapidConfigured: pub && priv,
      subscriptionRows,
      hint:
        !pub || !priv
          ? 'Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY on the server and restart Node.'
          : subscriptionRows === 0
            ? 'No browsers subscribed yet — enable background alerts in the club notification panel while logged in as club admin.'
            : 'Job runs every ~25s; push is sent only when a notification count increases (not for viewer count).',
    })
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || 'health check failed' })
  }
})

/** GET /api/push/vapid-public */
router.get('/vapid-public', (req, res) => {
  const publicKey = getVapidPublicKey()
  if (!publicKey) {
    return res.status(503).json({ ok: false, error: 'Web Push not configured (VAPID_PUBLIC_KEY)' })
  }
  res.json({ ok: true, publicKey })
})

/**
 * GET /api/push/service-worker.js
 * نفس محتوى dist/sw.js مع MIME صحيح؛ Service-Worker-Allowed يوسّع النطاق إلى /app/
 */
router.get('/service-worker.js', (req, res) => {
  if (!existsSync(SW_DIST_FILE)) {
    res.status(404).type('text/plain').send('dist/sw.js missing — run npm run build on the server')
    return
  }
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8')
  res.setHeader('Service-Worker-Allowed', '/')
  res.setHeader('Cache-Control', 'public, max-age=300')
  res.sendFile(SW_DIST_FILE, (err) => {
    if (err && !res.headersSent) {
      res.status(500).type('text/plain').send('service worker send failed')
    }
  })
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
       VALUES (?, ?, ?, ?, 
         CAST(? AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci, 
         CAST(? AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci, 
         ?, NULL)
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

/** POST /api/push/tab-hidden  Body: { endpoint } — عند إخفاء التبويب نلغي «مقدمة» حتى يُرسل Push فور زيادة عدّاد */
router.post('/tab-hidden', async (req, res) => {
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
      'UPDATE club_push_subscriptions SET last_foreground_ping_at = NULL WHERE endpoint_hash = ?',
      [eh]
    )
    res.json({ ok: true })
  } catch (e) {
    console.error('[push/tab-hidden]', e)
    res.status(500).json({ error: e?.message || 'tab-hidden failed' })
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
