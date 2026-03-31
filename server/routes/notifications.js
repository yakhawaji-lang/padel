/**
 * Club notification summary + lightweight live presence for public club page visitor counts.
 */
import { Router } from 'express'
import { query } from '../db/pool.js'

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

async function safeCount(sql, params) {
  try {
    const { rows } = await query(sql, params)
    return Number(rows?.[0]?.c || 0) || 0
  } catch (e) {
    return 0
  }
}

/**
 * GET /api/notifications/club/:clubId/summary
 */
router.get('/club/:clubId/summary', async (req, res) => {
  const clubId = String(req.params.clubId || '').trim()
  if (!clubId) return res.status(400).json({ error: 'clubId required' })

  const viewers = countClubPresence(clubId)

  const locksActive = await safeCount(
    `SELECT COUNT(*) AS c FROM booking_slot_locks WHERE club_id = ? AND expires_at > NOW()`,
    [clubId]
  )

  const bookingCompleteFlow = await safeCount(
    `SELECT COUNT(*) AS c FROM club_bookings 
     WHERE club_id = ? AND deleted_at IS NULL 
     AND LOWER(COALESCE(status,'')) IN ('initiated','locked','pending_payment')`,
    [clubId]
  )

  const bookingAwaitingPayments = await safeCount(
    `SELECT COUNT(*) AS c FROM club_bookings 
     WHERE club_id = ? AND deleted_at IS NULL 
     AND LOWER(COALESCE(status,'')) IN ('pending_payments','partially_paid')`,
    [clubId]
  )

  const bookingExpiredWithPayment = await safeCount(
    `SELECT COUNT(*) AS c FROM club_bookings 
     WHERE club_id = ? AND deleted_at IS NULL 
     AND LOWER(COALESCE(status,'')) = 'expired' 
     AND COALESCE(paid_amount,0) > 0.01`,
    [clubId]
  )

  let refundRequests = await safeCount(
    `SELECT COUNT(*) AS c FROM booking_payment_shares 
     WHERE club_id = ? 
     AND member_refund_requested_at IS NOT NULL 
     AND refunded_at IS NULL 
     AND removed_at IS NULL`,
    [clubId]
  )
  const refundRowsBooking = await safeCount(
    `SELECT COUNT(*) AS c FROM booking_refunds WHERE club_id = ? AND LOWER(COALESCE(status,'')) = 'pending'`,
    [clubId]
  )
  refundRequests += refundRowsBooking

  let storeSalesRecent = await safeCount(
    `SELECT COUNT(*) AS c FROM store_sales 
     WHERE club_id = ? AND deleted_at IS NULL 
     AND created_at > DATE_SUB(NOW(), INTERVAL 48 HOUR)`,
    [clubId]
  )

  const storeLowStock = await safeCount(
    `SELECT COUNT(*) AS c FROM store_products 
     WHERE club_id = ? AND deleted_at IS NULL AND stock IS NOT NULL AND stock <= 2`,
    [clubId]
  )

  const newMembers = await safeCount(
    `SELECT COUNT(*) AS c FROM member_clubs 
     WHERE club_id = ? AND joined_at > DATE_SUB(NOW(), INTERVAL 7 DAY)`,
    [clubId]
  )

  const counts = {
    viewers,
    locksActive,
    bookingCompleteFlow,
    bookingAwaitingPayments,
    bookingExpiredWithPayment,
    refundRequests,
    storeSalesRecent,
    storeLowStock,
    newMembers,
  }

  const fingerprint = JSON.stringify(counts)
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
