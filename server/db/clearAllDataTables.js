/**
 * تفريغ جميع جداول التطبيق (صفوف فقط) — نفس ترتيب server/db/CLEAR_ALL_DATA.sql
 * جداول الفواتير/المحفظة اختيارية؛ أخطاء «جدول غير موجود» تُتجاهل.
 */
import { query } from './pool.js'

export const TABLES_TO_TRUNCATE_ON_FULL_RESET = [
  'club_invoice_lines',
  'club_payments',
  'club_invoices',
  'club_invoice_seq',
  'match_teams',
  'matches',
  'member_stats',
  'tournament_summaries',
  'booking_payment_shares',
  'booking_refunds',
  'booking_slot_locks',
  'payment_idempotency',
  'member_wallet_ledger',
  'member_wallet',
  'club_directory_favorites',
  'member_favorites',
  'coach_training_invites',
  'club_push_subscriptions',
  'club_bookings',
  'club_accounting',
  'club_courts',
  'club_offers',
  'club_tournament_types',
  'club_admin_permissions',
  'club_social_links',
  'club_admin_users',
  'club_settings',
  'club_store',
  'store_sales',
  'store_products',
  'store_categories',
  'store_coupons',
  'platform_admin_permissions',
  'platform_payment_gateways',
  'member_points_history',
  'member_clubs',
  'members',
  'clubs',
  'platform_admins',
  'password_reset_tokens',
  'audit_log',
  'entities',
  'app_store',
  'app_settings'
]

function isMissingTableError (e) {
  const msg = e?.message || ''
  return msg.includes("doesn't exist") || msg.includes('Unknown table')
}

/** يفرغ كل الجداول المذكورة؛ لا يحذف بنية الجداول. */
export async function truncateAllApplicationTables () {
  await query('SET FOREIGN_KEY_CHECKS = 0')
  for (const t of TABLES_TO_TRUNCATE_ON_FULL_RESET) {
    try {
      await query(`TRUNCATE TABLE \`${t}\``)
    } catch (e) {
      if (!isMissingTableError(e)) throw e
    }
  }
  await query('SET FOREIGN_KEY_CHECKS = 1')
}
