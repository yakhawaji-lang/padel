-- ============================================================================
-- PlayTix — محفظة العضو لكل نادي + سياسات تعديل/إلغاء الحجز
-- نفّذ على قاعدة البيانات (phpMyAdmin → SQL) ثم أعد تشغيل Node
-- Raw: https://raw.githubusercontent.com/yakhawaji-lang/padel/main/server/db/migrations/add-member-wallet-and-booking-policies.sql
-- ============================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- أرصدة المحفظة (لكل عضو داخل كل نادي)
CREATE TABLE IF NOT EXISTS member_wallet (
  club_id VARCHAR(255) NOT NULL,
  member_id VARCHAR(255) NOT NULL,
  balance DECIMAL(14,2) NOT NULL DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (club_id, member_id),
  INDEX idx_mw_club (club_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- حركات المحفظة
CREATE TABLE IF NOT EXISTS member_wallet_ledger (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  club_id VARCHAR(255) NOT NULL,
  member_id VARCHAR(255) NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  direction ENUM('credit','debit') NOT NULL,
  balance_after DECIMAL(14,2) NOT NULL,
  reason VARCHAR(64) NOT NULL,
  ref_type VARCHAR(32) NULL,
  ref_id VARCHAR(255) NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_mwl_member (club_id, member_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- أعمدة سياسات الحجز في club_settings (مرة واحدة)
SET @cs := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'club_settings' AND COLUMN_NAME = 'reschedule_fee_mode'
);
SET @sql_rm := IF(@cs = 0,
  'ALTER TABLE club_settings ADD COLUMN reschedule_fee_mode VARCHAR(16) NOT NULL DEFAULT ''none'' COMMENT ''none|percent|fixed''',
  'SELECT 1');
PREPARE s1 FROM @sql_rm; EXECUTE s1; DEALLOCATE PREPARE s1;

SET @cs2 := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'club_settings' AND COLUMN_NAME = 'reschedule_fee_value'
);
SET @sql_rv := IF(@cs2 = 0,
  'ALTER TABLE club_settings ADD COLUMN reschedule_fee_value DECIMAL(10,2) NOT NULL DEFAULT 0',
  'SELECT 1');
PREPARE s2 FROM @sql_rv; EXECUTE s2; DEALLOCATE PREPARE s2;

SET @cs3 := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'club_settings' AND COLUMN_NAME = 'free_reschedule_count'
);
SET @sql_fc := IF(@cs3 = 0,
  'ALTER TABLE club_settings ADD COLUMN free_reschedule_count INT NOT NULL DEFAULT 1 COMMENT ''number of free edits (e.g. 1 = first free)''',
  'SELECT 1');
PREPARE s3 FROM @sql_fc; EXECUTE s3; DEALLOCATE PREPARE s3;

SET @cs4 := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'club_settings' AND COLUMN_NAME = 'cancel_refund_hours_before'
);
SET @sql_cb := IF(@cs4 = 0,
  'ALTER TABLE club_settings ADD COLUMN cancel_refund_hours_before INT NOT NULL DEFAULT 24 COMMENT ''min hours before start to allow cancel/refund''',
  'SELECT 1');
PREPARE s4 FROM @sql_cb; EXECUTE s4; DEALLOCATE PREPARE s4;

SET @cs5 := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'club_settings' AND COLUMN_NAME = 'cancel_fee_mode'
);
SET @sql_cm := IF(@cs5 = 0,
  'ALTER TABLE club_settings ADD COLUMN cancel_fee_mode VARCHAR(16) NOT NULL DEFAULT ''none''',
  'SELECT 1');
PREPARE s5 FROM @sql_cm; EXECUTE s5; DEALLOCATE PREPARE s5;

SET @cs6 := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'club_settings' AND COLUMN_NAME = 'cancel_fee_value'
);
SET @sql_cv := IF(@cs6 = 0,
  'ALTER TABLE club_settings ADD COLUMN cancel_fee_value DECIMAL(10,2) NOT NULL DEFAULT 0',
  'SELECT 1');
PREPARE s6 FROM @sql_cv; EXECUTE s6; DEALLOCATE PREPARE s6;

-- حقول إضافية لجدول refunds (قد يكون الجدول قديماً)
SET @br := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'booking_refunds' AND COLUMN_NAME = 'refund_route'
);
SET @sql_br := IF(@br = 0,
  'ALTER TABLE booking_refunds ADD COLUMN refund_route VARCHAR(24) NULL COMMENT ''wallet|original''',
  'SELECT 1');
PREPARE b1 FROM @sql_br; EXECUTE b1; DEALLOCATE PREPARE b1;

SET @br2 := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'booking_refunds' AND COLUMN_NAME = 'fee_amount'
);
SET @sql_br2 := IF(@br2 = 0,
  'ALTER TABLE booking_refunds ADD COLUMN fee_amount DECIMAL(10,2) NULL DEFAULT 0',
  'SELECT 1');
PREPARE b2 FROM @sql_br2; EXECUTE b2; DEALLOCATE PREPARE b2;

SET @br3 := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'booking_refunds' AND COLUMN_NAME = 'net_amount'
);
SET @sql_br3 := IF(@br3 = 0,
  'ALTER TABLE booking_refunds ADD COLUMN net_amount DECIMAL(10,2) NULL',
  'SELECT 1');
PREPARE b3 FROM @sql_br3; EXECUTE b3; DEALLOCATE PREPARE b3;

SET FOREIGN_KEY_CHECKS = 1;
