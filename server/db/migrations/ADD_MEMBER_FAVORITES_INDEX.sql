-- ============================================================================
-- فهرس لجلب مفضلات العضو حسب النادي (GET /api/bookings/favorites)
-- نفّذ مرة واحدة على قواعد أُنشئت قبل إضافة الفهرس إلى CREATE_ALL_TABLES.sql
-- ============================================================================
SET NAMES utf8mb4;

ALTER TABLE member_favorites
  ADD INDEX idx_member_favorites_member_club (member_id, club_id);
