-- ============================================================================
-- PlayTix — تفريغ جميع بيانات الجداول (الصفوف فقط) مع الإبقاء على هيكل الجداول
-- ============================================================================
-- ⚠️ تحذير: يحذف كل الحجوزات، الأعضاء، النوادي، الفواتير، المحافظ، السجلات، إلخ.
--    لا يمكن التراجع. خذ نسخة احتياطية (Export) قبل التنفيذ.
--
-- الاستخدام:
--   1) phpMyAdmin → اختر قاعدتك (مثلاً padel_db أو u502561206_padel_db)
--   2) تبويب SQL → الصق هذا الملف بالكامل → تنفيذ
--
-- إن ظهر خطأ "Table '...' doesn't exist": احذف أو علّق سطر TRUNCATE لذلك الجدول
-- (قاعدتك قد لا تحتوي كل الجداول إن لم تُنفَّذ كل الهجرات).
--
-- الفرق عن DROP_ALL_TABLES.sql: هنا نُفرّغ البيانات فقط ولا نحذف الجداول.
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
TRUNCATE TABLE `club_push_subscriptions`;
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

-- ----- متجر النادي -----
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

-- ----- Legacy (JSON في app_store / app_settings) -----
TRUNCATE TABLE `app_store`;
TRUNCATE TABLE `app_settings`;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================================
-- إعادة القيم الافتراضية الضرورية حتى لا تتعطل الواجهة أو إعدادات الدفع
-- ============================================================================

INSERT INTO `platform_payment_gateways` (gateway_key, enabled, config_json, display_name, display_name_ar, sort_order) VALUES
('at_club', 1, '{"description":"Pay at club with cash or card"}', 'At club', 'الدفع في النادي', 1),
('credit_card', 0, '{"provider":"stripe","publishableKey":"","secretKey":"","webhookSecret":"","description":"Online payment via Visa, Mastercard"}', 'Credit card', 'البطاقة الائتمانية', 2),
('mada', 0, '{"merchantId":"","apiKey":"","gatewayId":"","description":"متاب - بطاقة الدفع السعودية"}', 'Mada', 'متاب', 3),
('split', 1, '{"deadlineMinutes":30,"description":"Split payment with other participants"}', 'Split payment', 'تقسيم المبلغ', 4)
ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP;

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

-- انتهى. لإنشاء مسؤول منصة أو بيانات تجريبية استخدم واجهة التطبيق أو GET /api/init-db (بيئة التطوير).
