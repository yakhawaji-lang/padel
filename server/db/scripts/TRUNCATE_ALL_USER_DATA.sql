-- ============================================================================
-- ⚠️ PlayTix — مسح جميع البيانات التشغيلية (DEV / بيئة اختبار فقط)
-- ⚠️ DANGER: This deletes ALL clubs, members, bookings, invoices, wallets, etc.
--
-- قبل التنفيذ:
-- 1) خذ نسخة احتياطية كاملة (Export) من قاعدة البيانات.
-- 2) في phpMyAdmin: اختر قاعدتك (مثلاً padel_db أو u502561206_padel_db).
-- 3) نفّذ هذا الملف من تبويب SQL.
--
-- إن ظهر خطأ "Unknown table '...'" احذف أو علّق سطر TRUNCATE لذلك الجدول
-- (الخادم قد لا يحتوي كل الجداول بعد).
-- ============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----- فواتير ومدفوعات -----
TRUNCATE TABLE `club_invoice_lines`;
TRUNCATE TABLE `club_payments`;
TRUNCATE TABLE `club_invoices`;
TRUNCATE TABLE `club_invoice_seq`;

-- ----- بطولة / مباريات -----
TRUNCATE TABLE `match_teams`;
TRUNCATE TABLE `matches`;
TRUNCATE TABLE `member_stats`;
TRUNCATE TABLE `tournament_summaries`;

-- ----- حجوزات ودفع -----
TRUNCATE TABLE `booking_payment_shares`;
TRUNCATE TABLE `booking_refunds`;
TRUNCATE TABLE `booking_slot_locks`;
TRUNCATE TABLE `payment_idempotency`;

-- ----- محفظة العضو -----
TRUNCATE TABLE `member_wallet_ledger`;
TRUNCATE TABLE `member_wallet`;

-- ----- مفضلة وتدريب -----
TRUNCATE TABLE `member_favorites`;
TRUNCATE TABLE `coach_training_invites`;

-- ----- نوادي (تفاصيل) -----
TRUNCATE TABLE `club_bookings`;
TRUNCATE TABLE `club_accounting`;
TRUNCATE TABLE `club_courts`;
TRUNCATE TABLE `club_offers`;
TRUNCATE TABLE `club_tournament_types`;
TRUNCATE TABLE `club_admin_permissions`;
TRUNCATE TABLE `club_social_links`;
TRUNCATE TABLE `club_admin_users`;
TRUNCATE TABLE `club_settings`;
TRUNCATE TABLE `club_store`;

-- ----- متجر النادي (جداول منفصلة إن وُجدت) -----
TRUNCATE TABLE `store_sales`;
TRUNCATE TABLE `store_products`;
TRUNCATE TABLE `store_categories`;
TRUNCATE TABLE `store_coupons`;

-- ----- صلاحيات ومنصة -----
TRUNCATE TABLE `platform_admin_permissions`;
TRUNCATE TABLE `platform_payment_gateways`;

-- ----- أعضاء وروابط -----
TRUNCATE TABLE `member_points_history`;
TRUNCATE TABLE `member_clubs`;
TRUNCATE TABLE `members`;
TRUNCATE TABLE `clubs`;

TRUNCATE TABLE `platform_admins`;
TRUNCATE TABLE `password_reset_tokens`;
TRUNCATE TABLE `audit_log`;

TRUNCATE TABLE `entities`;

-- ----- تخزين Legacy (JSON في app_store / إعدادات الجلسات) -----
TRUNCATE TABLE `app_store`;
TRUNCATE TABLE `app_settings`;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================================
-- (اختياري) إعادة القيم الفارغة الافتراضية مثل تهيئة النظام — يُنصح بعد المسح
-- Optional: empty defaults so الواجهة لا تنهار قبل أول مزامنة
-- ============================================================================

INSERT IGNORE INTO `app_store` (`key`, `value`) VALUES ('admin_clubs', '[]');
INSERT IGNORE INTO `app_store` (`key`, `value`) VALUES ('all_members', '[]');
INSERT IGNORE INTO `app_store` (`key`, `value`) VALUES ('padel_members', '[]');
INSERT IGNORE INTO `app_store` (`key`, `value`) VALUES ('platform_admins', '[]');
INSERT IGNORE INTO `app_store` (`key`, `value`) VALUES ('admin_settings', '{}');
INSERT IGNORE INTO `app_store` (`key`, `value`) VALUES ('bookings', '[]');

INSERT IGNORE INTO `app_settings` (`key`, `value`) VALUES ('admin_settings', '{}');
INSERT IGNORE INTO `app_settings` (`key`, `value`) VALUES ('app_language', '"en"');
INSERT IGNORE INTO `app_settings` (`key`, `value`) VALUES ('current_member_id', 'null');
INSERT IGNORE INTO `app_settings` (`key`, `value`) VALUES ('admin_current_club_id', 'null');
INSERT IGNORE INTO `app_settings` (`key`, `value`) VALUES ('platform_admin_session', 'null');
INSERT IGNORE INTO `app_settings` (`key`, `value`) VALUES ('club_admin_session', 'null');
INSERT IGNORE INTO `app_settings` (`key`, `value`) VALUES ('current_club_admin_id', 'null');
INSERT IGNORE INTO `app_settings` (`key`, `value`) VALUES ('password_reset_tokens', '{}');

-- انتهى. لإنشاء أول مسؤول منصة استخدم واجهة التسجيل أو استورد من entities
-- كما في GET /api/init-db?reset=1 على بيئة التطوير.
-- ============================================================================
