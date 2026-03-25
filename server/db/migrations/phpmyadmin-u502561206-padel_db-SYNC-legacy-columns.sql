-- ============================================================================
-- Hostinger / phpMyAdmin — مزامنة أعمدة وجداول ناقصة مع مشروع PlayTix
-- القاعدة: u502561206_padel_db (أو أي padel_db)
-- ============================================================================
-- نفّذ **بعد** استيراد server/db/CREATE_ALL_TABLES.sql (أو إن كانت الجداول موجودة).
-- إذا ظهر خطأ "Duplicate column name" أو "Duplicate key name" → تجاهله وتابع.
-- في phpMyAdmin: اختر القاعدة → SQL → الصق الملف → تنفيذ.
-- رابط الملف على GitHub (main):
--   https://github.com/yakhawaji-lang/padel/blob/main/server/db/migrations/phpmyadmin-u502561206-padel_db-SYNC-legacy-columns.sql
-- رابط إنشاء/إكمال الجداول (نفّذه أولاً أو بالتوازي إن كانت الجداول ناقصة):
--   https://github.com/yakhawaji-lang/padel/blob/main/server/db/CREATE_ALL_TABLES.sql
-- ============================================================================

SET NAMES utf8mb4;

-- --- جدول بوابات الدفع (لوحة المدير الرئيسي) ---
CREATE TABLE IF NOT EXISTS platform_payment_gateways (
  id INT AUTO_INCREMENT PRIMARY KEY,
  gateway_key VARCHAR(50) NOT NULL UNIQUE,
  enabled TINYINT(1) DEFAULT 1,
  config_json TEXT,
  display_name VARCHAR(100),
  display_name_ar VARCHAR(100),
  sort_order INT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO platform_payment_gateways (gateway_key, enabled, config_json, display_name, display_name_ar, sort_order) VALUES
('at_club', 1, '{"description":"Pay at club with cash or card"}', 'At club', 'الدفع في النادي', 1),
('credit_card', 0, '{"provider":"stripe","publishableKey":"","secretKey":"","webhookSecret":"","description":"Online payment via Visa, Mastercard"}', 'Credit card', 'البطاقة الائتمانية', 2),
('mada', 0, '{"merchantId":"","apiKey":"","gatewayId":"","description":"متاب - بطاقة الدفع السعودية"}', 'Mada', 'متاب', 3),
('split', 1, '{"deadlineMinutes":30,"description":"Split payment with other participants"}', 'Split payment', 'تقسيم المبلغ', 4)
ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP;

-- --- حذف ناعم (جدول قديم بدون أعمدة) ---
ALTER TABLE matches ADD COLUMN deleted_at DATETIME NULL;
ALTER TABLE matches ADD COLUMN deleted_by VARCHAR(255) NULL;
ALTER TABLE member_stats ADD COLUMN deleted_at DATETIME NULL;
ALTER TABLE member_stats ADD COLUMN deleted_by VARCHAR(255) NULL;
ALTER TABLE tournament_summaries ADD COLUMN deleted_at DATETIME NULL;
ALTER TABLE tournament_summaries ADD COLUMN deleted_by VARCHAR(255) NULL;

-- --- أعضاء المنصة ---
ALTER TABLE members ADD COLUMN name_ar VARCHAR(255) NULL;
ALTER TABLE members ADD COLUMN mobile VARCHAR(50) NULL;
ALTER TABLE members ADD COLUMN password_hash VARCHAR(255) NULL;

-- --- عضويات النادي / المدربون ---
ALTER TABLE member_clubs ADD COLUMN is_coach TINYINT(1) DEFAULT 0;

-- --- إعدادات النادي (حجز، مواسم، دفع لكل نادي) ---
ALTER TABLE club_settings ADD COLUMN preparation_time_minutes INT DEFAULT 0;
ALTER TABLE club_settings ADD COLUMN lock_minutes INT DEFAULT 10;
ALTER TABLE club_settings ADD COLUMN payment_deadline_minutes INT DEFAULT 10;
ALTER TABLE club_settings ADD COLUMN split_manage_minutes INT DEFAULT 15;
ALTER TABLE club_settings ADD COLUMN split_payment_deadline_minutes INT DEFAULT 30;
ALTER TABLE club_settings ADD COLUMN refund_days INT DEFAULT 3;
ALTER TABLE club_settings ADD COLUMN allow_incomplete_bookings TINYINT(1) DEFAULT 0;
ALTER TABLE club_settings ADD COLUMN working_hours_seasons JSON NULL;
ALTER TABLE club_settings ADD COLUMN payment_enabled_channels JSON NULL;

-- --- الحجوزات ---
ALTER TABLE club_bookings ADD COLUMN start_time VARCHAR(10) NULL;
ALTER TABLE club_bookings ADD COLUMN end_time VARCHAR(10) NULL;
ALTER TABLE club_bookings ADD COLUMN locked_at DATETIME NULL;
ALTER TABLE club_bookings ADD COLUMN payment_deadline_at DATETIME NULL;
ALTER TABLE club_bookings ADD COLUMN total_amount DECIMAL(10,2) DEFAULT 0;
ALTER TABLE club_bookings ADD COLUMN paid_amount DECIMAL(10,2) DEFAULT 0;
ALTER TABLE club_bookings ADD COLUMN initiator_member_id VARCHAR(255) NULL;

-- --- أسهم الدفع ---
ALTER TABLE booking_payment_shares ADD COLUMN invite_token VARCHAR(64) NULL;
ALTER TABLE booking_payment_shares ADD COLUMN paid_at DATETIME NULL;
ALTER TABLE booking_payment_shares ADD COLUMN payment_reference VARCHAR(255) NULL;
ALTER TABLE booking_payment_shares ADD COLUMN payment_method VARCHAR(50) NULL;

-- --- فهارس موصى بها ---
CREATE INDEX idx_bps_invite_token ON booking_payment_shares (invite_token);
ALTER TABLE club_bookings ADD INDEX idx_cb_club_date (club_id, booking_date);
ALTER TABLE club_bookings ADD INDEX idx_cb_club_deleted (club_id, deleted_at);
ALTER TABLE booking_slot_locks ADD INDEX idx_bsl_club_date (club_id, booking_date);

-- --- ترحيل بيانات قديمة ---
UPDATE club_bookings SET start_time = time_slot WHERE start_time IS NULL AND time_slot IS NOT NULL;

-- ============================================================================
-- انتهى — بعد التنفيذ يفضّل تشغيل التطبيق؛ الخادم يضيف أي عمود ناقص تلقائياً عند الحفظ لبعض الجداول.
-- ============================================================================
