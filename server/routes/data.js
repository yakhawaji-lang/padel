/**
 * Data API - reads/writes from normalized tables or entities (fallback).
 * Single source of truth: database only.
 * يدعم الحذف المؤقت وتدقيق العمليات (audit).
 */
import { Router } from 'express'
import { query } from '../db/pool.js'
import { getActorFromRequest } from '../db/audit.js'
import { hasNormalizedTables, getClubsFromNormalized, getMembersFromNormalized, getPlatformAdminsFromNormalized, saveClubsToNormalized, saveMembersToNormalized, savePlatformAdminsToNormalized, deleteClubPermanent, removeMemberFromClub, updateClubSettingsInDb } from '../db/normalizedData.js'

const router = Router()

function dbErrorMsg(e) {
  const msg = e?.message || 'Database error'
  if (msg.includes('ENOTFOUND') || msg.includes('getaddrinfo')) {
    return 'Database host not found. In Hostinger Environment Variables, set DATABASE_URL with the actual MySQL host (e.g. srv2069.hstgr.io or localhost) — do NOT use the placeholder HOST.'
  }
  return msg
}

function isDeadlock(e) {
  const msg = (e?.message || '').toLowerCase()
  return e?.errno === 1213 || e?.code === 'ER_LOCK_DEADLOCK' || msg.includes('deadlock')
}

async function withDeadlockRetry(fn, maxAttempts = 3) {
  let lastErr
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (e) {
      lastErr = e
      if (isDeadlock(e) && attempt < maxAttempts) {
        await new Promise(r => setTimeout(r, 50 * attempt))
        continue
      }
      throw e
    }
  }
  throw lastErr
}

const ENTITY_KEYS = ['admin_clubs', 'all_members', 'padel_members', 'platform_admins']
const ENTITY_TYPE_MAP = {
  admin_clubs: 'club',
  all_members: 'member',
  padel_members: 'member',
  platform_admins: 'platform_admin'
}

async function useNormalized() {
  try {
    return await hasNormalizedTables()
  } catch {
    return false
  }
}

async function getFromNormalized(key) {
  if (key === 'admin_clubs') return await getClubsFromNormalized()
  if (key === 'all_members' || key === 'padel_members') return await getMembersFromNormalized()
  if (key === 'platform_admins') return await getPlatformAdminsFromNormalized()
  return null
}

async function getFromEntities(key) {
  const type = ENTITY_TYPE_MAP[key]
  const { rows } = await query('SELECT entity_id, data FROM entities WHERE entity_type = ?', [type])
  return rows.map(r => {
    const d = typeof r.data === 'object' ? r.data : JSON.parse(r.data || '{}')
    return { ...d, id: r.entity_id }
  })
}

/** POST /api/data/member-remove-from-club - Remove a member from one club (explicit). Body: { memberId, clubId } */
router.post('/member-remove-from-club', async (req, res) => {
  try {
    const { memberId, clubId } = req.body || {}
    if (!memberId || !clubId) return res.status(400).json({ error: 'Missing memberId or clubId' })
    const normalized = await useNormalized()
    if (!normalized) return res.status(400).json({ error: 'Requires normalized tables' })
    const actor = getActorFromRequest(req)
    const ok = await removeMemberFromClub(memberId, clubId, { actorType: actor.actorType || 'system', actorId: actor.actorId, actorName: actor.actorName, clubId, ipAddress: actor.ipAddress })
    if (!ok) return res.status(500).json({ error: 'Remove failed' })
    res.json({ ok: true })
  } catch (e) {
    console.error('member-remove-from-club error:', e)
    res.status(500).json({ error: dbErrorMsg(e) })
  }
})

/** POST /api/data/club-delete-permanent - Permanently delete a club from DB. Body: { clubId } */
router.post('/club-delete-permanent', async (req, res) => {
  try {
    const { clubId } = req.body || {}
    if (!clubId) return res.status(400).json({ error: 'Missing clubId' })
    const normalized = await useNormalized()
    if (!normalized) {
      return res.status(400).json({ error: 'Permanent delete requires normalized tables' })
    }
    const actor = getActorFromRequest(req)
    const ok = await deleteClubPermanent(clubId, actor)
    if (!ok) return res.status(500).json({ error: 'Delete failed' })
    res.json({ ok: true })
  } catch (e) {
    console.error('club-delete-permanent error:', e)
    res.status(500).json({ error: dbErrorMsg(e) })
  }
})

/** POST /api/data/club-settings — حفظ إعدادات نادٍ واحد مباشرة في padel_db. Body: { clubId, settings, booking? }.
 *  إعدادات الحجز (lockMinutes, allowIncompleteBookings, ...) تُؤخذ من booking إن وُجدت لضمان حفظ 0 و false. */
router.post('/club-settings', async (req, res) => {
  try {
    const { clubId, settings: rawSettings, booking: rawBooking } = req.body || {}
    if (!clubId || !rawSettings || typeof rawSettings !== 'object') {
      return res.status(400).json({ error: 'Missing clubId or settings' })
    }
    const settings = { ...rawSettings }
    if (rawBooking && typeof rawBooking === 'object') {
      if (rawBooking.lockMinutes !== undefined) settings.lockMinutes = Number(rawBooking.lockMinutes)
      if (rawBooking.paymentDeadlineMinutes !== undefined) settings.paymentDeadlineMinutes = Number(rawBooking.paymentDeadlineMinutes)
      if (rawBooking.splitManageMinutes !== undefined) settings.splitManageMinutes = Number(rawBooking.splitManageMinutes)
      if (rawBooking.splitPaymentDeadlineMinutes !== undefined) settings.splitPaymentDeadlineMinutes = Number(rawBooking.splitPaymentDeadlineMinutes)
      if (rawBooking.refundDays !== undefined) settings.refundDays = Number(rawBooking.refundDays)
      if (rawBooking.allowIncompleteBookings !== undefined) settings.allowIncompleteBookings = !!rawBooking.allowIncompleteBookings
    }
    const normalized = await useNormalized()
    if (!normalized) return res.status(400).json({ error: 'Requires normalized tables' })
    const actor = getActorFromRequest(req)
    const act = { actorType: actor.actorType || 'system', actorId: actor.actorId, actorName: actor.actorName, clubId, ipAddress: actor.ipAddress }
    const saved = await updateClubSettingsInDb(clubId, settings, act)
    if (!saved) return res.status(500).json({ error: 'Failed to save club settings' })
    return res.json({ ok: true, clubId: String(clubId), settings: saved })
  } catch (e) {
    console.error('club-settings save error:', e)
    res.status(500).json({ error: dbErrorMsg(e) })
  }
})

/** GET /api/data?keys=admin_clubs,all_members,... - Batch get from DB (must be before /:key) */
router.get('/', async (req, res) => {
  try {
    const keysParam = req.query.keys
    if (!keysParam) return res.status(400).json({ error: 'Missing keys' })
    const keys = keysParam.split(',').map(k => k.trim()).filter(Boolean)
    if (!keys.length) return res.json({})

    const normalized = await useNormalized()
    const result = {}

    for (const key of keys) {
      if (ENTITY_KEYS.includes(key)) {
        result[key] = normalized ? await getFromNormalized(key) : await getFromEntities(key)
      } else {
        const { rows } = await query('SELECT value FROM app_settings WHERE `key` = ?', [key])
        const raw = rows[0]?.value
        result[key] = raw === undefined || raw === null
          ? null
          : (typeof raw === 'object' ? raw : JSON.parse(raw || 'null'))
      }
    }
    res.json(result)
  } catch (e) {
    console.error('data get error:', e)
    res.status(500).json({ error: dbErrorMsg(e) })
  }
})

/** GET /api/data/:key - Single key get */
router.get('/:key', async (req, res) => {
  try {
    const key = req.params.key
    if (ENTITY_KEYS.includes(key)) {
      const normalized = await useNormalized()
      const arr = normalized ? await getFromNormalized(key) : await getFromEntities(key)
      return res.json(arr)
    }
    const { rows } = await query('SELECT value FROM app_settings WHERE `key` = ?', [key])
    const raw = rows[0]?.value
    const val = raw === undefined || raw === null ? null : (typeof raw === 'object' ? raw : JSON.parse(raw || 'null'))
    res.json(val)
  } catch (e) {
    console.error('data get single error:', e)
    res.status(500).json({ error: dbErrorMsg(e) })
  }
})

/** POST /api/data - Set key(s). Body: { key, value } or { items: [{ key, value }] }. يدعم X-Actor-Type, X-Actor-Id, X-Club-Id للتدقيق */
router.post('/', async (req, res) => {
  try {
    let items = req.body.items
    if (Array.isArray(items) && items.length > 0) {
      // batch
    } else if (req.body.key !== undefined) {
      items = [{ key: req.body.key, value: req.body.value }]
    } else {
      return res.status(400).json({ error: 'Missing key or items' })
    }

    const actor = getActorFromRequest(req)
    const normalized = await useNormalized()

    for (const { key, value } of items) {
      if (!key) continue
      if (ENTITY_KEYS.includes(key)) {
        const arr = Array.isArray(value) ? value : []

        if (normalized) {
          const act = { actorType: actor.actorType || 'system', actorId: actor.actorId, actorName: actor.actorName, clubId: actor.clubId, ipAddress: actor.ipAddress }
          if (key === 'admin_clubs') await withDeadlockRetry(() => saveClubsToNormalized(arr, act))
          else if (key === 'all_members' || key === 'padel_members') await withDeadlockRetry(() => saveMembersToNormalized(arr, act))
          else if (key === 'platform_admins') await withDeadlockRetry(() => savePlatformAdminsToNormalized(arr, act))
        } else {
          const type = ENTITY_TYPE_MAP[key]
          await query('DELETE FROM entities WHERE entity_type = ?', [type])
          for (const item of arr) {
            const id = (item?.id || item?.entity_id || 'item-' + Date.now() + '-' + Math.random().toString(36).slice(2)).toString()
            const data = JSON.stringify(item)
            await query(
              'INSERT INTO entities (entity_type, entity_id, data) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE data = VALUES(data), updated_at = NOW()',
              [type, id, data]
            )
          }
        }
      } else {
        await query(
          'INSERT INTO app_settings (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = NOW()',
          [key, JSON.stringify(value)]
        )
      }
    }
    res.json({ ok: true })
  } catch (e) {
    console.error('data post error:', e)
    res.status(500).json({ error: dbErrorMsg(e) })
  }
})

export default router
