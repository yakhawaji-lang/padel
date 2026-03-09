/**
 * Audit trail - تسجيل من قام بماذا ومتى
 */
import { query } from './pool.js'

/**
 * @param {Object} opts
 * @param {string} opts.tableName - اسم الجدول
 * @param {string} opts.recordId - معرف السجل
 * @param {'INSERT'|'UPDATE'|'DELETE'} opts.action
 * @param {'platform_admin'|'club_admin'|'member'|'system'} opts.actorType
 * @param {string} [opts.actorId]
 * @param {string} [opts.actorName]
 * @param {string} [opts.clubId]
 * @param {Object} [opts.oldValue]
 * @param {Object} [opts.newValue]
 * @param {string} [opts.ipAddress]
 */
export async function logAudit(opts) {
  try {
    await query(
      `INSERT INTO audit_log (table_name, record_id, action, actor_type, actor_id, actor_name, club_id, old_value, new_value, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        opts.tableName || '',
        String(opts.recordId ?? ''),
        opts.action || 'UPDATE',
        opts.actorType || 'system',
        opts.actorId || null,
        opts.actorName || null,
        opts.clubId || null,
        opts.oldValue != null ? JSON.stringify(opts.oldValue) : null,
        opts.newValue != null ? JSON.stringify(opts.newValue) : null,
        opts.ipAddress || null
      ]
    )
  } catch (e) {
    console.error('[audit] log failed:', e.message)
  }
}

/** استخراج بيانات المدخل من الـ request */
export function getActorFromRequest(req) {
  const type = req.headers['x-actor-type'] || 'system'
  const id = req.headers['x-actor-id'] || null
  const name = req.headers['x-actor-name'] || null
  const clubId = req.headers['x-club-id'] || null
  const ip = req.ip || req.connection?.remoteAddress || null
  return { actorType: type, actorId: id, actorName: name, clubId, ipAddress: ip }
}
