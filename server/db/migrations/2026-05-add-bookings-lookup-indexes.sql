-- ============================================================================
-- PlayTix — Add lookup indexes on club_bookings
-- Safe: pure ADD INDEX, no data changes, idempotent via IF NOT EXISTS pattern.
-- Run in phpMyAdmin once per database.
-- ============================================================================
SET @db := DATABASE();

-- idx_cb_club_court_date — covers availability lookups for a court on a date
SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.statistics
   WHERE table_schema = @db AND table_name = 'club_bookings'
     AND index_name = 'idx_cb_club_court_date') = 0,
  'ALTER TABLE club_bookings ADD INDEX idx_cb_club_court_date (club_id, court_id, booking_date)',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- idx_cb_member_status_date — covers "My Bookings" by member
SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.statistics
   WHERE table_schema = @db AND table_name = 'club_bookings'
     AND index_name = 'idx_cb_member_status_date') = 0,
  'ALTER TABLE club_bookings ADD INDEX idx_cb_member_status_date (member_id, deleted_at, booking_date)',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- idx_cb_club_status_date — covers admin bookings list filtering
SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.statistics
   WHERE table_schema = @db AND table_name = 'club_bookings'
     AND index_name = 'idx_cb_club_status_date') = 0,
  'ALTER TABLE club_bookings ADD INDEX idx_cb_club_status_date (club_id, status, booking_date)',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- idx_cb_club_payment_deadline — for booking expiry sweeps
SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.statistics
   WHERE table_schema = @db AND table_name = 'club_bookings'
     AND index_name = 'idx_cb_club_payment_deadline') = 0,
  'ALTER TABLE club_bookings ADD INDEX idx_cb_club_payment_deadline (club_id, payment_deadline_at)',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SELECT 'club_bookings indexes added' AS status;
