-- ============================================================================
-- PlayTix — Add soft-delete columns to financial tables
-- Critical user/money data should never be hard-deleted.
-- ============================================================================
SET @db := DATABASE();

-- booking_payment_shares.deleted_at + deleted_by
SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = @db AND table_name = 'booking_payment_shares'
     AND column_name = 'deleted_at') = 0,
  'ALTER TABLE booking_payment_shares
     ADD COLUMN deleted_at DATETIME NULL DEFAULT NULL,
     ADD COLUMN deleted_by VARCHAR(255) NULL DEFAULT NULL,
     ADD INDEX idx_bps_deleted_at (deleted_at)',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- booking_refunds.deleted_at + deleted_by
SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = @db AND table_name = 'booking_refunds'
     AND column_name = 'deleted_at') = 0,
  'ALTER TABLE booking_refunds
     ADD COLUMN deleted_at DATETIME NULL DEFAULT NULL,
     ADD COLUMN deleted_by VARCHAR(255) NULL DEFAULT NULL,
     ADD INDEX idx_br_deleted_at (deleted_at)',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- member_wallet_ledger.deleted_at — append-only but kept for compliance
SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = @db AND table_name = 'member_wallet_ledger'
     AND column_name = 'deleted_at') = 0,
  'ALTER TABLE member_wallet_ledger
     ADD COLUMN deleted_at DATETIME NULL DEFAULT NULL,
     ADD COLUMN deleted_by VARCHAR(255) NULL DEFAULT NULL,
     ADD INDEX idx_mwl_deleted_at (deleted_at)',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SELECT 'soft-delete columns added on financial tables' AS status;
