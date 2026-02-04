-- MySQL schema for PlayTix (Hostinger)

CREATE TABLE IF NOT EXISTS app_store (
  `key` VARCHAR(255) PRIMARY KEY,
  value JSON NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

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

CREATE TABLE IF NOT EXISTS tournament_summaries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  club_id VARCHAR(255) NOT NULL,
  data JSON NOT NULL,
  saved_at BIGINT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_tournament_summaries_club (club_id)
);

INSERT INTO app_store (`key`, value) VALUES ('admin_clubs', '[]')
ON DUPLICATE KEY UPDATE `key` = `key`;
