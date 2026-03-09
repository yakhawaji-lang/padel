-- Add password_hash and mobile to members table for platform member login
-- Run in phpMyAdmin if members table exists and lacks these columns

ALTER TABLE members ADD COLUMN password_hash VARCHAR(255) DEFAULT NULL;
ALTER TABLE members ADD COLUMN mobile VARCHAR(50) DEFAULT NULL;
