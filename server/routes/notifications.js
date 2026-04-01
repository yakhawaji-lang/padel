/**
 * Club notification summary + lightweight live presence for public club page visitor counts.
 */
import { Router } from 'express'
import { computeClubNotificationCounts } from '../services/clubNotificationSummary.js'

const router = Router()

const PRESENCE_TTL_MS = 120000
/** @type {Map<string, Map<string, number>>} clubId -> sessionId -> lastSeen */
const presenceByClub = new Map()

function pingClubPresence(clubId, sessionId) {
  const cid = String(clubId || '').trim()
  const sid = String(sessionId || '').trim() || `anon-${Math.random().toString(36).slice(2)}`
  if (!cid) return { sessionId: sid, viewers: 0 }
  let m = presenceByClub.get(cid)
  if (!m) {
    m = new Map()
    presenceByClub.set(cid, m)
  }
  const now = Date.now()
  m.set(sid, now)
  for (const [k, t] of m.entries()) {
    if (now - t > PRESENCE_TTL_MS) m.delete(k)
  }
  return { sessionId: sid, viewers: m.size }
}

function countClubPresence(clubId) {
  const cid = String(clubId || '').trim()
  if (!cid) return 0
  const m = presenceByClub.get(cid)
  if (!m) return 0
  const now = Date.now()
  let n = 0
  for (const t of m.values()) {
    if (now - t <= PRESENCE_TTL_MS) n++
  }
  return n
}

/**
 * GET /api/notifications/club/:clubId/summary
 */
router.get('/club/:clubId/summary', async (req, res) => {
  const clubId = String(req.params.clubId || '').trim()
  if (!clubId) return res.status(400).json({ error: 'clubId required' })

  const viewers = countClubPresence(clubId)
  const { counts, fingerprint } = await computeClubNotificationCounts(clubId, viewers)
  res.json({ ok: true, clubId, counts, fingerprint, at: new Date().toISOString() })
})

/**
 * POST /api/notifications/club/:clubId/presence
 * Body: { sessionId?: string }
 */
router.post('/club/:clubId/presence', (req, res) => {
  const clubId = String(req.params.clubId || '').trim()
  const sessionId = req.body?.sessionId
  const out = pingClubPresence(clubId, sessionId)
  res.json({ ok: true, ...out })
})

export default router
