/**
 * التحقق من أن المستخدم مسموح له باشتراك Web Push لنادٍ معيّن.
 */
import { query } from '../db/pool.js'
import { getActorFromRequest } from '../db/audit.js'

/**
 * @param {import('express').Request} req
 * @param {string} clubId
 * @returns {Promise<{ ok: boolean, status?: number, error?: string, adminUserId?: string | null }>}
 */
export async function assertClubPushActor(req, clubId) {
  const cid = String(clubId || '').trim()
  if (!cid) return { ok: false, status: 400, error: 'clubId required' }

  const actor = getActorFromRequest(req)

  if (actor.actorType === 'platform_admin' && actor.actorId) {
    const { rows } = await query(
      'SELECT id FROM platform_admins WHERE id = ? AND deleted_at IS NULL LIMIT 1',
      [actor.actorId]
    )
    if (rows?.length) return { ok: true, adminUserId: null }
  }

  if (actor.actorType !== 'club_admin' || !actor.actorId) {
    return { ok: false, status: 403, error: 'Club admin or platform admin required' }
  }

  if (String(actor.clubId || '').trim() !== cid) {
    return { ok: false, status: 403, error: 'Club mismatch' }
  }

  const { rows } = await query(
    'SELECT id FROM club_admin_users WHERE club_id = ? AND id = ? AND deleted_at IS NULL LIMIT 1',
    [cid, actor.actorId]
  )
  if (!rows?.length) return { ok: false, status: 403, error: 'Not a club admin for this club' }

  return { ok: true, adminUserId: actor.actorId }
}
