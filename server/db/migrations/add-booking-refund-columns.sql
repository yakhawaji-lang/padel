-- Refunds, participant removal, payer acknowledgment
-- Run in phpMyAdmin / mysql CLI. Ignore "Duplicate column" errors for columns you already have.

ALTER TABLE booking_payment_shares ADD COLUMN refunded_at DATETIME NULL;
ALTER TABLE booking_payment_shares ADD COLUMN refund_method VARCHAR(64) NULL;
ALTER TABLE booking_payment_shares ADD COLUMN refund_reference VARCHAR(255) NULL;
ALTER TABLE booking_payment_shares ADD COLUMN refund_notes VARCHAR(500) NULL;
ALTER TABLE booking_payment_shares ADD COLUMN refund_acknowledged_at DATETIME NULL;
ALTER TABLE booking_payment_shares ADD COLUMN removed_at DATETIME NULL;
