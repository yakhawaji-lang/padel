-- =============================================================================
-- Tournament data storage (MySQL) — PlayTix / padel app
-- =============================================================================
-- Runtime tournament UI state (King / Social, teams, courts, schedule, tabs…)
-- is stored in:  clubs.tournament_data
-- Type may be JSON or LONGTEXT (Hostinger often shows longtext): both work; the API
-- stores JSON as text and parses it (see normalizedData.js).
--
-- If phpMyAdmin shows:  #1060 - Duplicate column name 'tournament_data'
-- → the column ALREADY EXISTS. Do nothing; do NOT run the ALTER below.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- STEP 1a — Check using current database (works when phpMyAdmin has DB selected)
-- If this returns one row → column exists → skip STEP 2.
-- If EMPTY: run STEP 1b (DATABASE() is often wrong if no DB selected in left sidebar)
-- -----------------------------------------------------------------------------
SELECT COLUMN_NAME, DATA_TYPE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'clubs'
  AND COLUMN_NAME = 'tournament_data';

-- -----------------------------------------------------------------------------
-- STEP 1b — Hostinger / phpMyAdmin: use your real schema name (left sidebar)
-- Replace u502561206_padel_db if yours differs.
-- -----------------------------------------------------------------------------
SELECT COLUMN_NAME, DATA_TYPE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'u502561206_padel_db'
  AND TABLE_NAME = 'clubs'
  AND COLUMN_NAME = 'tournament_data';

-- Or open: Structure → table `clubs` → confirm column `tournament_data` (JSON or LONGTEXT).

-- -----------------------------------------------------------------------------
-- STEP 2 — ONLY if BOTH checks above return zero rows AND Structure has no column
-- If you ever get #1060 Duplicate column → column already exists; do NOT run ALTER.
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
