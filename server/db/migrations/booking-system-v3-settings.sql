-- ============================================================================
-- Booking System V3 - Club settings columns (if missing)
-- u502561206_padel_db
-- ============================================================================
-- Run in phpMyAdmin. Ignore "Duplicate column" errors.
-- ============================================================================

ALTER TABLE club_settings ADD COLUMN split_manage_minutes INT DEFAULT 15;
ALTER TABLE club_settings ADD COLUMN split_payment_deadline_minutes INT DEFAULT 30;
ALTER TABLE club_settings ADD COLUMN refund_days INT DEFAULT 3;
ALTER TABLE club_settings ADD COLUMN allow_incomplete_bookings TINYINT(1) DEFAULT 0;
