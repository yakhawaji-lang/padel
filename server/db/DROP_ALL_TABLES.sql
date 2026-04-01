-- ============================================================================
-- حذف جميع الجداول — قاعدة PlayTix / padel
-- ============================================================================
-- الاستخدام: phpMyAdmin → اختر القاعدة → تبويب SQL → الصق ونفّذ.
-- تحذير: يحذف كل الجداول وكل البيانات. لا يمكن التراجع.
--
-- الفرق عن CLEAR_ALL_DATA.sql:
--   هذا الملف يحذف الجداول نفسها (يجب إعادة تشغيل CREATE_ALL_TABLES أو الهجرات).
--   CLEAR_ALL_DATA.sql يفرّغ الصفوف فقط ويبقي الهيكل ويُعيد إدخالات افتراضية بسيطة.
-- ============================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- ----- فواتير ومدفوعات -----
DROP TABLE IF EXISTS club_invoice_lines;
DROP TABLE IF EXISTS club_payments;
DROP TABLE IF EXISTS club_invoices;
DROP TABLE IF EXISTS club_invoice_seq;

-- ----- محفظة -----
DROP TABLE IF EXISTS member_wallet_ledger;
DROP TABLE IF EXISTS member_wallet;

-- ----- حجوزات ودفع -----
DROP TABLE IF EXISTS booking_payment_shares;
DROP TABLE IF EXISTS booking_refunds;
DROP TABLE IF EXISTS booking_slot_locks;
DROP TABLE IF EXISTS payment_idempotency;

-- ----- بطولة / مباريات -----
DROP TABLE IF EXISTS match_teams;
DROP TABLE IF EXISTS matches;
DROP TABLE IF EXISTS member_stats;
DROP TABLE IF EXISTS tournament_summaries;

-- ----- مفضلة وتدريب -----
DROP TABLE IF EXISTS member_favorites;
DROP TABLE IF EXISTS coach_training_invites;

-- ----- نوادي -----
DROP TABLE IF EXISTS club_push_subscriptions;
DROP TABLE IF EXISTS club_bookings;
DROP TABLE IF EXISTS club_accounting;
DROP TABLE IF EXISTS club_courts;
DROP TABLE IF EXISTS club_offers;
DROP TABLE IF EXISTS club_tournament_types;
DROP TABLE IF EXISTS club_admin_permissions;
DROP TABLE IF EXISTS club_social_links;
DROP TABLE IF EXISTS club_admin_users;
DROP TABLE IF EXISTS club_settings;
DROP TABLE IF EXISTS club_store;

-- ----- متجر النادي -----
DROP TABLE IF EXISTS store_sales;
DROP TABLE IF EXISTS store_products;
DROP TABLE IF EXISTS store_categories;
DROP TABLE IF EXISTS store_coupons;

-- ----- صلاحيات ومنصة -----
DROP TABLE IF EXISTS platform_admin_permissions;
DROP TABLE IF EXISTS platform_payment_gateways;

-- ----- أعضاء وروابط -----
DROP TABLE IF EXISTS member_points_history;
DROP TABLE IF EXISTS member_clubs;
DROP TABLE IF EXISTS members;
DROP TABLE IF EXISTS clubs;

DROP TABLE IF EXISTS platform_admins;
DROP TABLE IF EXISTS password_reset_tokens;
DROP TABLE IF EXISTS audit_log;

DROP TABLE IF EXISTS entities;

-- ----- Legacy -----
DROP TABLE IF EXISTS app_store;
DROP TABLE IF EXISTS app_settings;

SET FOREIGN_KEY_CHECKS = 1;

-- انتهى. القاعدة بلا جداول. أعد إنشاء الهيكل من CREATE_ALL_TABLES.sql والهجرات حسب بيئتك.
