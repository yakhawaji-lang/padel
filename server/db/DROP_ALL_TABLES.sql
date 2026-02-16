-- ============================================================================
-- مسح كل الجداول والارتباطات دفعة واحدة — padel_db / u502561206_padel_db
-- ============================================================================
-- الاستخدام: في phpMyAdmin اختر القاعدة ثم تبويب SQL والصق هذا الملف ونفّذه.
-- تحذير: يحذف كل الجداول وكل البيانات. لا يمكن التراجع.
-- ============================================================================

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS payment_idempotency;
DROP TABLE IF EXISTS member_favorites;
DROP TABLE IF EXISTS booking_refunds;
DROP TABLE IF EXISTS booking_slot_locks;
DROP TABLE IF EXISTS password_reset_tokens;
DROP TABLE IF EXISTS match_teams;
DROP TABLE IF EXISTS store_coupons;
DROP TABLE IF EXISTS store_sales;
DROP TABLE IF EXISTS store_products;
DROP TABLE IF EXISTS store_categories;
DROP TABLE IF EXISTS member_points_history;
DROP TABLE IF EXISTS club_social_links;
DROP TABLE IF EXISTS club_admin_permissions;
DROP TABLE IF EXISTS platform_admin_permissions;
DROP TABLE IF EXISTS club_store;
DROP TABLE IF EXISTS club_tournament_types;
DROP TABLE IF EXISTS club_accounting;
DROP TABLE IF EXISTS booking_payment_shares;
DROP TABLE IF EXISTS club_bookings;
DROP TABLE IF EXISTS club_offers;
DROP TABLE IF EXISTS club_admin_users;
DROP TABLE IF EXISTS club_settings;
DROP TABLE IF EXISTS club_courts;
DROP TABLE IF EXISTS member_clubs;
DROP TABLE IF EXISTS clubs;
DROP TABLE IF EXISTS members;
DROP TABLE IF EXISTS platform_admins;
DROP TABLE IF EXISTS audit_log;
DROP TABLE IF EXISTS tournament_summaries;
DROP TABLE IF EXISTS member_stats;
DROP TABLE IF EXISTS matches;
DROP TABLE IF EXISTS app_settings;
DROP TABLE IF EXISTS entities;
DROP TABLE IF EXISTS app_store;

SET FOREIGN_KEY_CHECKS = 1;

-- انتهى. القاعدة فارغة من الجداول. يمكنك الآن تشغيل ملف الإنشاء من جديد.
