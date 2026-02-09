-- ============================================================================
-- Add booking_payment_shares table - u502561206_padel_db
-- مشاركة الدفع للحجوزات — جدول مستقل لتخزين المشاركين في الدفع
-- ============================================================================
-- انسخ الأوامر التالية (من CREATE TABLE إلى النهاية) والصقها في phpMyAdmin
-- Copy the SQL below (from CREATE TABLE to the end) and paste into phpMyAdmin
-- لا تنفذ اسم الملف — نفذ محتوى الملف فقط | Do NOT run the filename — run the file contents only
-- ============================================================================

CREATE TABLE IF NOT EXISTS booking_payment_shares (
  id INT AUTO_INCREMENT PRIMARY KEY,
  booking_id VARCHAR(255) NOT NULL,
  club_id VARCHAR(255) NOT NULL,
  participant_type ENUM('registered', 'unregistered') NOT NULL DEFAULT 'registered',
  member_id VARCHAR(255) NULL,
  member_name VARCHAR(255) NULL,
  phone VARCHAR(50) NULL,
  amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  whatsapp_link TEXT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_bps_booking (booking_id, club_id),
  INDEX idx_bps_club (club_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
