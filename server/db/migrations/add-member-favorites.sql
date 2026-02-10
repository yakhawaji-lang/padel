-- ============================================================================
-- Add member_favorites table - للأعضاء المفضلين
-- ============================================================================
-- Run in phpMyAdmin or apply via migration tool
-- ============================================================================

CREATE TABLE IF NOT EXISTS member_favorites (
  id INT AUTO_INCREMENT PRIMARY KEY,
  member_id VARCHAR(255) NOT NULL,
  club_id VARCHAR(255) NOT NULL,
  favorite_member_id VARCHAR(255) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_member_club_favorite (member_id, club_id, favorite_member_id),
  INDEX idx_mf_member_club (member_id, club_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
