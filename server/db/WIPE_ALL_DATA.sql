-- ============================================================================
-- PlayTix — مسح جميع بيانات قاعدة البيانات (تطهير كامل)
-- ============================================================================
-- تحذير: يحذف كل الصفوف من الجداول المذكورة؛ لا يحذف بنية الجداول.
--         انسخ احتياطياً كاملاً قبل التنفيذ (mysqldump أو Export من phpMyAdmin).
--
-- الجزء (1) أدناه يطابق جداول CREATE_ALL_TABLES.sql + جداول الفواتير/المحفظة
-- الشائعة في التهجيرات. إن فشل سطر TRUNCATE بسبب «جدول غير موجود»، احذف
-- الأسطر الخاصة بذلك الجدول فقط وأعد التشغيل.
--
-- بعد التنفيذ: أعد إنشاء مالك المنصة من التطبيق، وأعد ضبط مفاتيح الدفع إن لزم.
-- ============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- --- فواتير ومدفوعات (إن وُجدت بعد migrations/add-club-invoicing-system.sql) ---
TRUNCATE TABLE club_invoice_lines;
TRUNCATE TABLE club_payments;
TRUNCATE TABLE club_invoices;
TRUNCATE TABLE club_invoice_seq;

-- --- محفظة العضو (إن وُجدت بعد migrations/add-member-wallet-and-booking-policies.sql) ---
TRUNCATE TABLE member_wallet_ledger;
TRUNCATE TABLE member_wallet;

-- --- حجوزات ودفع وتقسيم ---
TRUNCATE TABLE booking_refunds;
TRUNCATE TABLE booking_payment_shares;
TRUNCATE TABLE booking_slot_locks;
TRUNCATE TABLE payment_idempotency;
TRUNCATE TABLE coach_training_invites;
TRUNCATE TABLE member_favorites;
TRUNCATE TABLE match_teams;
TRUNCATE TABLE member_points_history;
TRUNCATE TABLE club_social_links;
TRUNCATE TABLE club_admin_permissions;
TRUNCATE TABLE platform_admin_permissions;

-- --- متجر النادي ---
TRUNCATE TABLE store_coupons;
TRUNCATE TABLE store_sales;
TRUNCATE TABLE store_products;
TRUNCATE TABLE store_categories;
TRUNCATE TABLE club_store;

-- --- نادي: بيانات تشغيل ---
TRUNCATE TABLE club_tournament_types;
TRUNCATE TABLE club_accounting;
TRUNCATE TABLE club_bookings;
TRUNCATE TABLE club_offers;
TRUNCATE TABLE club_push_subscriptions;
TRUNCATE TABLE club_admin_users;
TRUNCATE TABLE club_courts;
TRUNCATE TABLE club_settings;
TRUNCATE TABLE member_clubs;

-- --- منصة: أعضاء، مباريات، ملخصات ---
TRUNCATE TABLE member_stats;
TRUNCATE TABLE matches;
TRUNCATE TABLE tournament_summaries;
TRUNCATE TABLE members;
TRUNCATE TABLE clubs;
TRUNCATE TABLE platform_admins;
TRUNCATE TABLE audit_log;
TRUNCATE TABLE password_reset_tokens;
TRUNCATE TABLE entities;

-- --- تخزين عام ---
TRUNCATE TABLE app_store;
TRUNCATE TABLE app_settings;

-- --- بوابات الدفع الافتراضية (يُفرغ ثم يُعاد لاحقاً) ---
TRUNCATE TABLE platform_payment_gateways;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================================
-- بذور دنيا للتشغيل (مطابقة لـ CREATE_ALL_TABLES.sql)
-- ============================================================================

INSERT IGNORE INTO app_store (`key`, value) VALUES ('admin_clubs', '[]');
INSERT IGNORE INTO app_store (`key`, value) VALUES ('all_members', '[]');
INSERT IGNORE INTO app_store (`key`, value) VALUES ('padel_members', '[]');
INSERT IGNORE INTO app_store (`key`, value) VALUES ('platform_admins', '[]');
INSERT IGNORE INTO app_store (`key`, value) VALUES ('admin_settings', '{}');
INSERT IGNORE INTO app_store (`key`, value) VALUES ('bookings', '[]');

INSERT IGNORE INTO app_settings (`key`, value) VALUES ('admin_settings', '{}');
INSERT IGNORE INTO app_settings (`key`, value) VALUES ('app_language', '"en"');
INSERT IGNORE INTO app_settings (`key`, value) VALUES ('current_member_id', 'null');
INSERT IGNORE INTO app_settings (`key`, value) VALUES ('admin_current_club_id', 'null');
INSERT IGNORE INTO app_settings (`key`, value) VALUES ('platform_admin_session', 'null');
INSERT IGNORE INTO app_settings (`key`, value) VALUES ('club_admin_session', 'null');
INSERT IGNORE INTO app_settings (`key`, value) VALUES ('current_club_admin_id', 'null');
INSERT IGNORE INTO app_settings (`key`, value) VALUES ('password_reset_tokens', '{}');

INSERT INTO platform_payment_gateways (gateway_key, enabled, config_json, display_name, display_name_ar, sort_order) VALUES
('at_club', 1, '{"description":"Pay at club with cash or card"}', 'At club', 'الدفع في النادي', 1),
('credit_card', 0, '{"provider":"stripe","publishableKey":"","secretKey":"","webhookSecret":"","description":"Online payment via Visa, Mastercard"}', 'Credit card', 'البطاقة الائتمانية', 2),
('mada', 0, '{"merchantId":"","apiKey":"","gatewayId":"","description":"متاب - بطاقة الدفع السعودية"}', 'Mada', 'متاب', 3),
('split', 1, '{"deadlineMinutes":30,"description":"Split payment with other participants"}', 'Split payment', 'تقسيم المبلغ', 4)
ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP;

-- ============================================================================
-- تحقق سريع: SELECT COUNT(*) AS n FROM members;
--             SELECT COUNT(*) AS n FROM clubs;
-- ============================================================================
