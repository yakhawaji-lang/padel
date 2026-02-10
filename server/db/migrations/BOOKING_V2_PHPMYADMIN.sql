-- ============================================================================
-- Booking System V2 - تشغيل من phpMyAdmin على u502561206_padel_db
-- نفّذ الأوامر بالترتيب. إذا ظهر خطأ "Duplicate column" تجاهله وتابع.
-- ============================================================================

-- 1) إنشاء جدول booking_slot_locks
CREATE TABLE IF NOT EXISTS booking_slot_locks (
  id VARCHAR(64) PRIMARY KEY,
  club_id VARCHAR(255) NOT NULL,
  court_id VARCHAR(255) NOT NULL,
  booking_date DATE NOT NULL,
  start_time VARCHAR(10) NOT NULL,
  end_time VARCHAR(10) NOT NULL,
  member_id VARCHAR(255) NOT NULL,
  booking_id VARCHAR(255) NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_bsl_slot (club_id, court_id, booking_date, start_time),
  INDEX idx_bsl_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2) إضافة أعمدة لـ club_settings (تجاهل "Duplicate column" إن ظهر)
ALTER TABLE club_settings ADD COLUMN lock_minutes INT DEFAULT 10;
ALTER TABLE club_settings ADD COLUMN payment_deadline_minutes INT DEFAULT 10;
ALTER TABLE club_settings ADD COLUMN split_manage_minutes INT DEFAULT 15;
ALTER TABLE club_settings ADD COLUMN split_payment_deadline_minutes INT DEFAULT 30;
ALTER TABLE club_settings ADD COLUMN refund_days INT DEFAULT 3;
ALTER TABLE club_settings ADD COLUMN allow_incomplete_bookings TINYINT(1) DEFAULT 0;

-- 3) إضافة أعمدة لـ club_bookings (تجاهل "Duplicate column" إن ظهر)
ALTER TABLE club_bookings ADD COLUMN start_time VARCHAR(10) NULL;
ALTER TABLE club_bookings ADD COLUMN end_time VARCHAR(10) NULL;
ALTER TABLE club_bookings ADD COLUMN locked_at DATETIME NULL;
ALTER TABLE club_bookings ADD COLUMN payment_deadline_at DATETIME NULL;
ALTER TABLE club_bookings ADD COLUMN total_amount DECIMAL(10,2) DEFAULT 0;
ALTER TABLE club_bookings ADD COLUMN paid_amount DECIMAL(10,2) DEFAULT 0;
ALTER TABLE club_bookings ADD COLUMN initiator_member_id VARCHAR(255) NULL;

-- 4) إضافة أعمدة لـ booking_payment_shares (تجاهل "Duplicate column" إن ظهر)
ALTER TABLE booking_payment_shares ADD COLUMN invite_token VARCHAR(64) NULL;
ALTER TABLE booking_payment_shares ADD COLUMN paid_at DATETIME NULL;
ALTER TABLE booking_payment_shares ADD COLUMN payment_reference VARCHAR(255) NULL;

-- إنشاء الفهرس (تجاهل "Duplicate key" إن ظهر)
CREATE INDEX idx_bps_invite_token ON booking_payment_shares (invite_token);

-- 5) إنشاء جدول booking_refunds
CREATE TABLE IF NOT EXISTS booking_refunds (
  id INT AUTO_INCREMENT PRIMARY KEY,
  booking_id VARCHAR(255) NOT NULL,
  club_id VARCHAR(255) NOT NULL,
  member_id VARCHAR(255) NULL,
  amount DECIMAL(10,2) NOT NULL,
  status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
  expected_by_date DATE NULL,
  completed_at DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_br_booking (booking_id, club_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6) إنشاء جدول member_favorites
CREATE TABLE IF NOT EXISTS member_favorites (
  member_id VARCHAR(255) NOT NULL,
  favorite_member_id VARCHAR(255) NOT NULL,
  club_id VARCHAR(255) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (member_id, favorite_member_id, club_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7) ملء start_time من time_slot للحجوزات القديمة
UPDATE club_bookings SET start_time = time_slot WHERE start_time IS NULL AND time_slot IS NOT NULL;
