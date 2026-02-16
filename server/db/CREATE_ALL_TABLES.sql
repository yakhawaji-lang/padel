-- ============================================================================
-- PlayTix — إنشاء كل الجداول والحقول والفهارس (padel_db / u502561206_padel_db)
-- ============================================================================
-- الاستخدام: نفّذ بعد DROP_ALL_TABLES.sql أو على قاعدة فارغة.
-- في phpMyAdmin: اختر القاعدة → تبويب SQL → الصق هذا الملف → تنفيذ.
-- ============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ============ 1) الجداول الأساسية (Legacy) ============
CREATE TABLE IF NOT EXISTS app_store (
  `key` VARCHAR(255) PRIMARY KEY,
  value JSON NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS entities (
  id INT AUTO_INCREMENT PRIMARY KEY,
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(255) NOT NULL,
  data JSON NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_entity (entity_type, entity_id),
  INDEX idx_entity_type (entity_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS app_settings (
  `key` VARCHAR(255) PRIMARY KEY,
  value JSON NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS matches (
  id INT AUTO_INCREMENT PRIMARY KEY,
  club_id VARCHAR(255) NOT NULL,
  tournament_type VARCHAR(255) NOT NULL,
  tournament_id INT NOT NULL,
  data JSON NOT NULL,
  saved_at BIGINT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  deleted_by VARCHAR(255) NULL,
  INDEX idx_matches_club (club_id),
  INDEX idx_matches_tournament (club_id, tournament_type, tournament_id),
  INDEX idx_matches_saved_at (saved_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS member_stats (
  id INT AUTO_INCREMENT PRIMARY KEY,
  club_id VARCHAR(255) NOT NULL,
  member_id VARCHAR(255) NOT NULL,
  tournament_id INT NOT NULL,
  data JSON NOT NULL,
  saved_at BIGINT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  deleted_by VARCHAR(255) NULL,
  INDEX idx_member_stats_club (club_id),
  INDEX idx_member_stats_member (member_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tournament_summaries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  club_id VARCHAR(255) NOT NULL,
  data JSON NOT NULL,
  saved_at BIGINT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  deleted_by VARCHAR(255) NULL,
  INDEX idx_tournament_summaries_club (club_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============ 2) الجداول المنظمة (Normalized) ============
CREATE TABLE IF NOT EXISTS audit_log (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  table_name VARCHAR(100) NOT NULL,
  record_id VARCHAR(255) NOT NULL,
  action ENUM('INSERT','UPDATE','DELETE') NOT NULL,
  actor_type ENUM('platform_admin','club_admin','member','system') NOT NULL DEFAULT 'system',
  actor_id VARCHAR(255) NULL,
  actor_name VARCHAR(255) NULL,
  club_id VARCHAR(255) NULL,
  old_value JSON NULL,
  new_value JSON NULL,
  ip_address VARCHAR(45) NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_table (table_name),
  INDEX idx_audit_record (table_name, record_id),
  INDEX idx_audit_actor (actor_type, actor_id),
  INDEX idx_audit_created (created_at),
  INDEX idx_audit_club (club_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS platform_admins (
  id VARCHAR(255) PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'admin',
  permissions JSON NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by VARCHAR(255) NULL,
  updated_by VARCHAR(255) NULL,
  deleted_at DATETIME NULL,
  deleted_by VARCHAR(255) NULL,
  INDEX idx_pa_email (email),
  INDEX idx_pa_deleted (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS members (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  name_ar VARCHAR(255) NULL,
  email VARCHAR(255) NULL,
  avatar VARCHAR(500) NULL,
  mobile VARCHAR(50) NULL,
  password_hash VARCHAR(255) NULL,
  total_points INT DEFAULT 0,
  total_games INT DEFAULT 0,
  total_wins INT DEFAULT 0,
  points_history JSON NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by VARCHAR(255) NULL,
  updated_by VARCHAR(255) NULL,
  deleted_at DATETIME NULL,
  deleted_by VARCHAR(255) NULL,
  INDEX idx_members_deleted (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS clubs (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  name_ar VARCHAR(255) NULL,
  logo VARCHAR(500) NULL,
  banner VARCHAR(500) NULL,
  tagline VARCHAR(500) NULL,
  tagline_ar VARCHAR(500) NULL,
  address VARCHAR(500) NULL,
  address_ar VARCHAR(500) NULL,
  phone VARCHAR(50) NULL,
  email VARCHAR(255) NULL,
  website VARCHAR(500) NULL,
  playtomic_venue_id VARCHAR(255) NULL,
  playtomic_api_key VARCHAR(500) NULL,
  status VARCHAR(50) DEFAULT 'active',
  store_enabled TINYINT(1) DEFAULT 0,
  tournament_data JSON NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by VARCHAR(255) NULL,
  updated_by VARCHAR(255) NULL,
  deleted_at DATETIME NULL,
  deleted_by VARCHAR(255) NULL,
  INDEX idx_clubs_status (status),
  INDEX idx_clubs_deleted (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS member_clubs (
  member_id VARCHAR(255) NOT NULL,
  club_id VARCHAR(255) NOT NULL,
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (member_id, club_id),
  INDEX idx_mc_club (club_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS club_courts (
  id VARCHAR(255) NOT NULL,
  club_id VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  name_ar VARCHAR(100) NULL,
  type VARCHAR(20) DEFAULT 'indoor',
  maintenance TINYINT(1) DEFAULT 0,
  image VARCHAR(500) NULL,
  sort_order INT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by VARCHAR(255) NULL,
  updated_by VARCHAR(255) NULL,
  deleted_at DATETIME NULL,
  deleted_by VARCHAR(255) NULL,
  PRIMARY KEY (id, club_id),
  INDEX idx_cc_club (club_id),
  INDEX idx_cc_deleted (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS club_settings (
  club_id VARCHAR(255) PRIMARY KEY,
  default_language VARCHAR(10) DEFAULT 'en',
  timezone VARCHAR(50) DEFAULT 'Asia/Riyadh',
  currency VARCHAR(10) DEFAULT 'SAR',
  booking_duration INT DEFAULT 60,
  max_booking_advance INT DEFAULT 30,
  cancellation_policy INT DEFAULT 24,
  opening_time VARCHAR(10) DEFAULT '06:00',
  closing_time VARCHAR(10) DEFAULT '23:00',
  header_bg_color VARCHAR(20) DEFAULT '#ffffff',
  header_text_color VARCHAR(20) DEFAULT '#0f172a',
  hero_bg_color VARCHAR(20) NULL,
  hero_bg_opacity INT NULL,
  hero_title_color VARCHAR(20) NULL,
  hero_text_color VARCHAR(20) NULL,
  hero_stats_color VARCHAR(20) NULL,
  social_links JSON NULL,
  booking_prices JSON NULL,
  lock_minutes INT DEFAULT 10,
  payment_deadline_minutes INT DEFAULT 10,
  split_manage_minutes INT DEFAULT 15,
  split_payment_deadline_minutes INT DEFAULT 30,
  refund_days INT DEFAULT 3,
  allow_incomplete_bookings TINYINT(1) DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by VARCHAR(255) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS club_admin_users (
  id VARCHAR(255) NOT NULL,
  club_id VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  is_owner TINYINT(1) DEFAULT 0,
  permissions JSON NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by VARCHAR(255) NULL,
  updated_by VARCHAR(255) NULL,
  deleted_at DATETIME NULL,
  deleted_by VARCHAR(255) NULL,
  PRIMARY KEY (id, club_id),
  INDEX idx_cau_club (club_id),
  INDEX idx_cau_deleted (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS club_offers (
  id VARCHAR(255) NOT NULL,
  club_id VARCHAR(255) NOT NULL,
  title VARCHAR(255) NULL,
  title_ar VARCHAR(255) NULL,
  description TEXT NULL,
  description_ar TEXT NULL,
  image VARCHAR(500) NULL,
  valid_from DATE NULL,
  valid_until DATE NULL,
  sort_order INT DEFAULT 0,
  data JSON NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by VARCHAR(255) NULL,
  updated_by VARCHAR(255) NULL,
  deleted_at DATETIME NULL,
  deleted_by VARCHAR(255) NULL,
  PRIMARY KEY (id, club_id),
  INDEX idx_co_club (club_id),
  INDEX idx_co_deleted (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS club_bookings (
  id VARCHAR(255) NOT NULL,
  club_id VARCHAR(255) NOT NULL,
  court_id VARCHAR(255) NULL,
  member_id VARCHAR(255) NULL,
  booking_date DATE NULL,
  time_slot VARCHAR(50) NULL,
  start_time VARCHAR(10) NULL,
  end_time VARCHAR(10) NULL,
  status VARCHAR(50) NULL,
  data JSON NULL,
  locked_at DATETIME NULL,
  payment_deadline_at DATETIME NULL,
  total_amount DECIMAL(10,2) DEFAULT 0,
  paid_amount DECIMAL(10,2) DEFAULT 0,
  initiator_member_id VARCHAR(255) NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by VARCHAR(255) NULL,
  updated_by VARCHAR(255) NULL,
  deleted_at DATETIME NULL,
  deleted_by VARCHAR(255) NULL,
  PRIMARY KEY (id, club_id),
  INDEX idx_cb_club (club_id),
  INDEX idx_cb_deleted (deleted_at),
  INDEX idx_cb_club_date (club_id, booking_date),
  INDEX idx_cb_club_deleted (club_id, deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
  payment_reference VARCHAR(255) NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_bps_booking (booking_id, club_id),
  INDEX idx_bps_club (club_id),
  INDEX idx_bps_invite_token (invite_token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS club_accounting (
  id INT AUTO_INCREMENT PRIMARY KEY,
  club_id VARCHAR(255) NOT NULL,
  entry_date DATE NULL,
  description VARCHAR(500) NULL,
  amount DECIMAL(12,2) DEFAULT 0,
  entry_type VARCHAR(50) NULL,
  category VARCHAR(100) NULL,
  data JSON NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by VARCHAR(255) NULL,
  updated_by VARCHAR(255) NULL,
  deleted_at DATETIME NULL,
  deleted_by VARCHAR(255) NULL,
  INDEX idx_ca_club (club_id),
  INDEX idx_ca_deleted (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS club_tournament_types (
  id VARCHAR(255) NOT NULL,
  club_id VARCHAR(255) NOT NULL,
  name VARCHAR(255) NULL,
  name_ar VARCHAR(255) NULL,
  description TEXT NULL,
  description_ar TEXT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  deleted_by VARCHAR(255) NULL,
  PRIMARY KEY (id, club_id),
  INDEX idx_ctt_club (club_id),
  INDEX idx_ctt_deleted (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS club_store (
  club_id VARCHAR(255) PRIMARY KEY,
  data JSON NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by VARCHAR(255) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============ 3) الجداول العلائقية والإضافية ============
CREATE TABLE IF NOT EXISTS platform_admin_permissions (
  admin_id VARCHAR(255) NOT NULL,
  permission VARCHAR(100) NOT NULL,
  PRIMARY KEY (admin_id, permission),
  INDEX idx_pap_admin (admin_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS club_admin_permissions (
  admin_id VARCHAR(255) NOT NULL,
  club_id VARCHAR(255) NOT NULL,
  permission VARCHAR(100) NOT NULL,
  PRIMARY KEY (admin_id, club_id, permission),
  INDEX idx_cap_club (club_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS club_social_links (
  id INT AUTO_INCREMENT PRIMARY KEY,
  club_id VARCHAR(255) NOT NULL,
  platform VARCHAR(50) NOT NULL,
  url VARCHAR(500) NOT NULL,
  sort_order INT DEFAULT 0,
  INDEX idx_csl_club (club_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS member_points_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  member_id VARCHAR(255) NOT NULL,
  tournament_id INT NULL,
  points INT DEFAULT 0,
  recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_mph_member (member_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS store_categories (
  id VARCHAR(255) NOT NULL,
  club_id VARCHAR(255) NOT NULL,
  name VARCHAR(255) NULL,
  name_ar VARCHAR(255) NULL,
  sort_order INT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  deleted_by VARCHAR(255) NULL,
  PRIMARY KEY (id, club_id),
  INDEX idx_sc_club (club_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS store_products (
  id VARCHAR(255) NOT NULL,
  club_id VARCHAR(255) NOT NULL,
  category_id VARCHAR(255) NULL,
  name VARCHAR(255) NULL,
  name_ar VARCHAR(255) NULL,
  price DECIMAL(12,2) DEFAULT 0,
  stock INT DEFAULT 0,
  image VARCHAR(500) NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  deleted_by VARCHAR(255) NULL,
  PRIMARY KEY (id, club_id),
  INDEX idx_sp_club (club_id),
  INDEX idx_sp_category (category_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS store_sales (
  id INT AUTO_INCREMENT PRIMARY KEY,
  club_id VARCHAR(255) NOT NULL,
  product_id VARCHAR(255) NULL,
  quantity INT DEFAULT 1,
  amount DECIMAL(12,2) DEFAULT 0,
  sale_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  extra_data_text TEXT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  deleted_by VARCHAR(255) NULL,
  INDEX idx_ss_club (club_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS store_coupons (
  id VARCHAR(255) NOT NULL,
  club_id VARCHAR(255) NOT NULL,
  code VARCHAR(100) NOT NULL,
  discount DECIMAL(10,2) DEFAULT 0,
  valid_from DATE NULL,
  valid_until DATE NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  deleted_by VARCHAR(255) NULL,
  PRIMARY KEY (id, club_id),
  INDEX idx_sco_club (club_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS match_teams (
  id INT AUTO_INCREMENT PRIMARY KEY,
  match_id INT NOT NULL,
  team_label VARCHAR(10) NOT NULL,
  player1_id VARCHAR(255) NULL,
  player2_id VARCHAR(255) NULL,
  score INT DEFAULT 0,
  INDEX idx_mt_match (match_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  token VARCHAR(255) NOT NULL,
  user_type VARCHAR(50) NOT NULL,
  user_id VARCHAR(255) NULL,
  club_id VARCHAR(255) NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_prt_token (token),
  INDEX idx_prt_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============ 4) Booking System V2 ============
CREATE TABLE IF NOT EXISTS booking_slot_locks (
  id VARCHAR(64) PRIMARY KEY,
  club_id VARCHAR(255) NOT NULL,
  court_id VARCHAR(255) NOT NULL,
  booking_date DATE NOT NULL,
  start_time VARCHAR(10) NOT NULL,
  end_time VARCHAR(10) NOT NULL,
  member_id VARCHAR(255) NOT NULL,
  booking_id VARCHAR(255) NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_bsl_slot (club_id, court_id, booking_date, start_time),
  INDEX idx_bsl_expires (expires_at),
  INDEX idx_bsl_club_date (club_id, booking_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS booking_refunds (
  id INT AUTO_INCREMENT PRIMARY KEY,
  booking_id VARCHAR(255) NOT NULL,
  club_id VARCHAR(255) NOT NULL,
  member_id VARCHAR(255) NULL,
  amount DECIMAL(10,2) NOT NULL,
  status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
  expected_by_date DATE NULL,
  completed_at DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_br_booking (booking_id, club_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS member_favorites (
  member_id VARCHAR(255) NOT NULL,
  favorite_member_id VARCHAR(255) NOT NULL,
  club_id VARCHAR(255) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (member_id, favorite_member_id, club_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payment_idempotency (
  idempotency_key VARCHAR(128) PRIMARY KEY,
  booking_id VARCHAR(255) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_pi_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============ 5) بيانات افتراضية ============
INSERT IGNORE INTO app_store (`key`, value) VALUES ('admin_clubs', '[]');
INSERT IGNORE INTO app_store (`key`, value) VALUES ('all_members', '[]');
INSERT IGNORE INTO app_store (`key`, value) VALUES ('padel_members', '[]');
INSERT IGNORE INTO app_store (`key`, value) VALUES ('platform_admins', '[]');
INSERT IGNORE INTO app_store (`key`, value) VALUES ('admin_settings', '{}');
INSERT IGNORE INTO app_store (`key`, value) VALUES ('bookings', '[]');
INSERT IGNORE INTO app_settings (`key`, value) VALUES ('admin_settings', '{}');
INSERT IGNORE INTO app_settings (`key`, value) VALUES ('app_language', '"en"');
INSERT IGNORE INTO app_settings (`key`, value) VALUES ('current_member_id', 'null');
INSERT IGNORE INTO app_settings (`key`, value) VALUES ('admin_current_club_id', 'null');
INSERT IGNORE INTO app_settings (`key`, value) VALUES ('platform_admin_session', 'null');
INSERT IGNORE INTO app_settings (`key`, value) VALUES ('club_admin_session', 'null');
INSERT IGNORE INTO app_settings (`key`, value) VALUES ('current_club_admin_id', 'null');
INSERT IGNORE INTO app_settings (`key`, value) VALUES ('password_reset_tokens', '{}');

SET FOREIGN_KEY_CHECKS = 1;

-- ============ انتهى ============
-- العلاقات بين الجداول منطقياً (بدون FOREIGN KEY في MySQL):
--   member_clubs: member_id → members.id, club_id → clubs.id
--   club_courts, club_settings, club_admin_users, club_offers, club_bookings,
--   club_accounting, club_tournament_types, club_store: club_id → clubs.id
--   booking_payment_shares: booking_id+club_id → club_bookings
--   audit_log: سجل تدقيق عام
