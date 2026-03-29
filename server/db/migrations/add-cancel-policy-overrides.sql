-- Optional per booking-type cancel/refund policy overrides (JSON on club_settings)
-- Applied automatically on API startup via server/db/bookingMigration.js
--
-- If you see: #1060 Duplicate column name 'cancel_policy_overrides'
--   → The column already exists. Nothing to do; your schema is OK.
--
-- MySQL 5.7.8+ / MariaDB 10.2.7+ (JSON type). Run only once on hosts without Node migration.

ALTER TABLE club_settings ADD COLUMN cancel_policy_overrides JSON NULL COMMENT 'e.g. {"training":{"cancelRefundHoursBefore":48,"cancelFeeMode":"percent","cancelFeeValue":10}}';

-- Idempotent alternative (MariaDB 10.3+ only — comment out the line above if you use this):
-- ALTER TABLE club_settings ADD COLUMN IF NOT EXISTS cancel_policy_overrides JSON NULL COMMENT 'e.g. {"training":{"cancelRefundHoursBefore":48,"cancelFeeMode":"percent","cancelFeeValue":10}}';
