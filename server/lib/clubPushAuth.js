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
      `SELECT id FROM platform_admins 
       WHERE id = CAST(? AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci 
       AND deleted_at IS NULL LIMIT 1`,
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

  const actorId = String(actor.actorId || '').trim()
  /**
   * الواجهة تخزّن للمالك userId: 'owner' (ليس id من club_admin_users).
   * نطابق إما id الفعلي أو صف is_owner=1 عندما الجلسة ترسل 'owner'.
   */
  const { rows } = await query(
    `SELECT id FROM club_admin_users 
     WHERE club_id = CAST(? AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci 
     AND deleted_at IS NULL 
     AND (
       id = CAST(? AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci 
       OR (LOWER(CAST(? AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci) = 'owner' AND is_owner = 1)
     )
     LIMIT 1`,
    [cid, actorId, actorId]
  )
  if (!rows?.length) return { ok: false, status: 403, error: 'Not a club admin for this club' }

  return { ok: true, adminUserId: rows[0].id }
}
