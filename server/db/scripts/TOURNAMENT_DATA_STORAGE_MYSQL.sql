-- =============================================================================
-- Tournament data storage (MySQL) — PlayTix / padel app
-- =============================================================================
-- Runtime tournament UI state (King of the Court, Social, tabs, standings,
-- teams, courts, schedule as edited in the app) is persisted on the club row:
--   clubs.tournament_data  (JSON)
--
-- Tournament bookings (calendar rows, "Old Tournaments") live in:
--   club_bookings          with data JSON: isTournament, tournamentType, etc.
--
-- Per-guest payment invites / shares for a tournament booking:
--   booking_payment_shares (invite_token, whatsapp_link, participant_type, …)
--
-- If your production DB was created before these columns existed, run the
-- ALTER statements below (ignore "duplicate column" errors if already applied).
-- =============================================================================

-- Club-level JSON blob for king/social state maps and UI tabs
-- (see saveClubsToNormalized in server/db/normalizedData.js)
ALTER TABLE clubs
  ADD COLUMN tournament_data JSON NULL
  AFTER store_enabled;

-- booking_payment_shares: guest fee links (create-tournament-guest-fee-share)
-- Full definition is in server/db/CREATE_ALL_TABLES.sql — excerpt for reference:
/*
CREATE TABLE IF NOT EXISTS booking_payment_shares (
  id INT AUTO_INCREMENT PRIMARY KEY,
  booking_id VARCHAR(255) NOT NULL,
  club_id VARCHAR(255) NOT NULL,
  participant_type ENUM('registered', 'unregistered') NOT NULL DEFAULT 'registered',
  member_id VARCHAR(255) NULL,
  member_name VARCHAR(255) NULL,
  phone VARCHAR(50) NULL,
  amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  whatsapp_link TEXT NULL,
  invite_token VARCHAR(64) NULL,
  paid_at DATETIME NULL,
  removed_at DATETIME NULL,
  ...
  INDEX idx_bps_booking (booking_id, club_id),
  INDEX idx_bps_invite_token (invite_token)
);
*/

-- Helpful index for idempotent resend: unpaid share by booking + normalized phone
-- (optional; LOWER(TRIM(phone)) cannot use index fully but filters booking_id first)
-- CREATE INDEX idx_bps_booking_phone_unpaid
--   ON booking_payment_shares (booking_id, club_id, paid_at, removed_at, phone(20));
