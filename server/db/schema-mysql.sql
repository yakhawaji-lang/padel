-- PlayTix MySQL Schema - All data in database

-- ===== Legacy app_store (kept for migration/fallback) =====
CREATE TABLE IF NOT EXISTS app_store (
  `key` VARCHAR(255) PRIMARY KEY,
  value JSON NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ===== Entities: clubs, members, platform_admins =====
CREATE TABLE IF NOT EXISTS entities (
  id INT AUTO_INCREMENT PRIMARY KEY,
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(255) NOT NULL,
  data JSON NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_entity (entity_type, entity_id),
  INDEX idx_entity_type (entity_type)
);

-- ===== App settings (key-value for settings, language, session prefs) =====
CREATE TABLE IF NOT EXISTS app_settings (
  `key` VARCHAR(255) PRIMARY KEY,
  value JSON,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ===== Matches (tournament match data) =====
CREATE TABLE IF NOT EXISTS matches (
  id INT AUTO_INCREMENT PRIMARY KEY,
  club_id VARCHAR(255) NOT NULL,
  tournament_type VARCHAR(255) NOT NULL,
  tournament_id INT NOT NULL,
  data JSON NOT NULL,
  saved_at BIGINT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_matches_club (club_id),
  INDEX idx_matches_tournament (club_id, tournament_type, tournament_id),
  INDEX idx_matches_saved_at (saved_at)
);

-- ===== Member stats =====
CREATE TABLE IF NOT EXISTS member_stats (
  id INT AUTO_INCREMENT PRIMARY KEY,
  club_id VARCHAR(255) NOT NULL,
  member_id VARCHAR(255) NOT NULL,
  tournament_id INT NOT NULL,
  data JSON NOT NULL,
  saved_at BIGINT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_member_stats_club (club_id),
  INDEX idx_member_stats_member (member_id)
);

-- ===== Tournament summaries =====
CREATE TABLE IF NOT EXISTS tournament_summaries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  club_id VARCHAR(255) NOT NULL,
  data JSON NOT NULL,
  saved_at BIGINT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_tournament_summaries_club (club_id)
);

-- ===== Seed app_store for backward compatibility =====
INSERT IGNORE INTO app_store (`key`, value) VALUES ('admin_clubs', '[]');
INSERT IGNORE INTO app_store (`key`, value) VALUES ('all_members', '[]');
INSERT IGNORE INTO app_store (`key`, value) VALUES ('padel_members', '[]');
INSERT IGNORE INTO app_store (`key`, value) VALUES ('platform_admins', '[]');
INSERT IGNORE INTO app_store (`key`, value) VALUES ('admin_settings', '{}');
INSERT IGNORE INTO app_store (`key`, value) VALUES ('bookings', '[]');

-- ===== Seed default app settings =====
INSERT IGNORE INTO app_settings (`key`, value) VALUES ('admin_settings', '{}');
INSERT IGNORE INTO app_settings (`key`, value) VALUES ('app_language', '"en"');
