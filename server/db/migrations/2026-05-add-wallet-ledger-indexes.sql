-- ============================================================================
-- PlayTix — Add lookup indexes on member_wallet_ledger
-- ============================================================================
SET @db := DATABASE();

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.statistics
   WHERE table_schema = @db AND table_name = 'member_wallet_ledger'
     AND index_name = 'idx_mwl_ref') = 0,
  'ALTER TABLE member_wallet_ledger ADD INDEX idx_mwl_ref (ref_type, ref_id)',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.statistics
   WHERE table_schema = @db AND table_name = 'member_wallet_ledger'
     AND index_name = 'idx_mwl_club_created') = 0,
  'ALTER TABLE member_wallet_ledger ADD INDEX idx_mwl_club_created (club_id, created_at)',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SELECT 'member_wallet_ledger indexes added' AS status;
