-- ============================================================================
-- PlayTix — Add lookup indexes on booking_payment_shares
-- Safe: pure ADD INDEX, no data changes.
-- ============================================================================
SET @db := DATABASE();

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.statistics
   WHERE table_schema = @db AND table_name = 'booking_payment_shares'
     AND index_name = 'idx_bps_member_club') = 0,
  'ALTER TABLE booking_payment_shares ADD INDEX idx_bps_member_club (member_id, club_id)',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.statistics
   WHERE table_schema = @db AND table_name = 'booking_payment_shares'
     AND index_name = 'idx_bps_club_paid') = 0,
  'ALTER TABLE booking_payment_shares ADD INDEX idx_bps_club_paid (club_id, paid_at)',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.statistics
   WHERE table_schema = @db AND table_name = 'booking_payment_shares'
     AND index_name = 'idx_bps_club_refunded') = 0,
  'ALTER TABLE booking_payment_shares ADD INDEX idx_bps_club_refunded (club_id, refunded_at)',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SELECT 'booking_payment_shares indexes added' AS status;
