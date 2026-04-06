-- ============================================================================
-- مفضلة دليل النادي (club admin / owner) — لزراعة قواعد موجودة مسبقاً
-- ============================================================================
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS club_directory_favorites (
  club_id VARCHAR(255) NOT NULL,
  member_id VARCHAR(255) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by_actor_id VARCHAR(255) NULL,
  PRIMARY KEY (club_id, member_id),
  INDEX idx_cdf_club (club_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
