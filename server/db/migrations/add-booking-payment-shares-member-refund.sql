-- Member share self-service refund (wallet / cash / card route + pending timestamp)
-- Applied automatically on API startup via server/db/bookingMigration.js
-- Run this file manually only if you cannot restart Node (ignore "Duplicate column" errors)

ALTER TABLE booking_payment_shares ADD COLUMN member_refund_route VARCHAR(24) NULL;
ALTER TABLE booking_payment_shares ADD COLUMN member_refund_requested_at DATETIME NULL;
ALTER TABLE booking_payment_shares ADD COLUMN member_refund_net DECIMAL(10,2) NULL;
