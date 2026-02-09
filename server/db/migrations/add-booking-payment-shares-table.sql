-- ============================================================================
-- Add booking_payment_shares table - u502561206_padel_db
-- مشاركة الدفع للحجوزات — جدول مستقل لتخزين المشاركين في الدفع
-- ============================================================================
-- Run this on your MySQL database (u502561206_padel_db) to add the table.
-- Example: mysql -u USER -p u502561206_padel_db < server/db/migrations/add-booking-payment-shares-table.sql
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
