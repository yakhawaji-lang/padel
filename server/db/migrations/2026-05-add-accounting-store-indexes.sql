-- ============================================================================
-- PlayTix — Add lookup indexes on club_accounting, store_sales, booking_refunds
-- ============================================================================
SET @db := DATABASE();

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.statistics
   WHERE table_schema = @db AND table_name = 'club_accounting'
     AND index_name = 'idx_ca_club_date') = 0,
  'ALTER TABLE club_accounting ADD INDEX idx_ca_club_date (club_id, entry_date)',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.statistics
   WHERE table_schema = @db AND table_name = 'store_sales'
     AND index_name = 'idx_ss_club_date') = 0,
  'ALTER TABLE store_sales ADD INDEX idx_ss_club_date (club_id, sale_date)',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.statistics
   WHERE table_schema = @db AND table_name = 'booking_refunds'
     AND index_name = 'idx_br_club_status') = 0,
  'ALTER TABLE booking_refunds ADD INDEX idx_br_club_status (club_id, status)',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SELECT 'accounting + store indexes added' AS status;
