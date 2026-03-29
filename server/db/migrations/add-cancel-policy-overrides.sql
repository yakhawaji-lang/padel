-- Optional per booking-type cancel/refund policy overrides (JSON on club_settings)
-- Applied automatically on API startup via server/db/bookingMigration.js
-- Run manually if Node is not restarted (MySQL 5.7.8+ / MariaDB 10.2.7+ for JSON type)

ALTER TABLE club_settings ADD COLUMN cancel_policy_overrides JSON NULL COMMENT 'e.g. {"training":{"cancelRefundHoursBefore":48,"cancelFeeMode":"percent","cancelFeeValue":10}}';
