-- ============================================================================
-- Coaches & Training Bookings
-- 1. member_clubs: add is_coach
-- 2. club_bookings: training stored in data JSON (type, coachId, maxTrainees, pricePerHour)
-- ============================================================================

-- 1. member_clubs: allow marking members as coaches per club
-- (تجاهل "Duplicate column" إن ظهر)
ALTER TABLE member_clubs ADD COLUMN is_coach TINYINT(1) DEFAULT 0;
