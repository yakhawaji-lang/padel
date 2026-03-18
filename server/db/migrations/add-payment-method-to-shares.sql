-- Add payment_method to booking_payment_shares (at_club | electronic)
-- Run if column doesn't exist
ALTER TABLE booking_payment_shares ADD COLUMN payment_method VARCHAR(50) NULL;
