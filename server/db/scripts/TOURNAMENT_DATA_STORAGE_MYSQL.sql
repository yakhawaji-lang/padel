-- =============================================================================
-- Tournament data storage (MySQL) — PlayTix / padel app
-- =============================================================================
-- Runtime tournament UI state (King / Social, teams, courts, schedule, tabs…)
-- is stored in:  clubs.tournament_data  (JSON)
--
-- If phpMyAdmin shows:  #1060 - Duplicate column name 'tournament_data'
-- → the column ALREADY EXISTS. Do nothing; do NOT run the ALTER below.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- STEP 1 — Check if tournament_data exists (run this first)
-- If this returns one row, you are done — skip STEP 2 entirely.
-- -----------------------------------------------------------------------------
SELECT COLUMN_NAME, DATA_TYPE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'clubs'
  AND COLUMN_NAME = 'tournament_data';

-- -----------------------------------------------------------------------------
-- STEP 2 — ONLY if STEP 1 returned zero rows (old database without the column)
-- Uncomment the next 3 lines and execute once:
-- -----------------------------------------------------------------------------
-- ALTER TABLE clubs
--   ADD COLUMN tournament_data JSON NULL
--   AFTER store_enabled;

-- -----------------------------------------------------------------------------
-- Reference: full schema in server/db/CREATE_ALL_TABLES.sql
-- booking_payment_shares already has invite_token, whatsapp_link, etc.
-- Optional index for resend lookups (uncomment if you want it; skip if duplicate index error):
-- -----------------------------------------------------------------------------
-- CREATE INDEX idx_bps_booking_phone_unpaid
--   ON booking_payment_shares (booking_id, club_id, paid_at, removed_at, phone(20));
