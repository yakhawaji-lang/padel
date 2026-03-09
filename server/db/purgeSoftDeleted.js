/**
 * حذف نهائي للسجلات المحذوفة (soft deleted) بعد مرور 3 أشهر
 */
import { query, getPool } from './pool.js'

const TABLES_WITH_SOFT_DELETE = [
  'platform_admins',
  'members',
  'clubs',
  'club_courts',
  'club_admin_users',
  'club_offers',
  'club_bookings',
  'club_accounting',
  'club_tournament_types'
]

export async function purgeSoftDeleted() {
  const stats = {}
  const pool = getPool()
  for (const table of TABLES_WITH_SOFT_DELETE) {
    try {
      const [result] = await pool.execute(
        `DELETE FROM \`${table}\` WHERE deleted_at IS NOT NULL AND deleted_at < DATE_SUB(NOW(), INTERVAL 3 MONTH)`
      )
      stats[table] = result?.affectedRows ?? 0
    } catch (e) {
      if (e.message?.includes("doesn't exist")) {
        stats[table] = 0
      } else {
        stats[table] = 'error: ' + e.message
        console.error('[purge]', table, e.message)
      }
    }
  }

  // matches, member_stats, tournament_summaries - تحذف إن وُجد عمود deleted_at
  for (const tbl of ['matches', 'member_stats', 'tournament_summaries']) {
    try {
      const [res] = await pool.execute(
        `DELETE FROM \`${tbl}\` WHERE deleted_at IS NOT NULL AND deleted_at < DATE_SUB(NOW(), INTERVAL 3 MONTH)`
      )
      stats[tbl] = res?.affectedRows ?? 0
    } catch (e) {
      if (e.message?.includes("Unknown column 'deleted_at'")) stats[tbl] = 0
      else {
        stats[tbl] = 'skip: ' + e.message
        console.error('[purge]', tbl, e.message)
      }
    }
  }

  return stats
}
