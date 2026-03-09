-- ============================================================================
-- PlayTix - هيكل قاعدة البيانات العلائقية (بدون JSON)
-- u502561206_padel_db - كل البيانات في MySQL فقط
-- ============================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- ============ app_settings (key-value بدون JSON) ============
CREATE TABLE IF NOT EXISTS app_settings (
  `key` VARCHAR(255) PRIMARY KEY,
  value_text TEXT,
  value_type VARCHAR(20) DEFAULT 'string',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============ audit_log ============
CREATE TABLE IF NOT EXISTS audit_log (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  table_name VARCHAR(100) NOT NULL,
  record_id VARCHAR(255) NOT NULL,
  action ENUM('INSERT','UPDATE','DELETE') NOT NULL,
  actor_type ENUM('platform_admin','club_admin','member','system') NOT NULL DEFAULT 'system',
  actor_id VARCHAR(255) NULL,
  actor_name VARCHAR(255) NULL,
  club_id VARCHAR(255) NULL,
  old_value_text TEXT NULL,
  new_value_text TEXT NULL,
  ip_address VARCHAR(45) NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_table (table_name),
  INDEX idx_audit_record (table_name, record_id),
  INDEX idx_audit_actor (actor_type, actor_id),
  INDEX idx_audit_created (created_at),
  INDEX idx_audit_club (club_id)
);

-- ============ platform_admins ============
CREATE TABLE IF NOT EXISTS platform_admins (
  id VARCHAR(255) PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'admin',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by VARCHAR(255) NULL,
  updated_by VARCHAR(255) NULL,
  deleted_at DATETIME NULL,
  deleted_by VARCHAR(255) NULL,
  INDEX idx_pa_email (email),
  INDEX idx_pa_deleted (deleted_at)
);

-- ============ platform_admin_permissions ============
CREATE TABLE IF NOT EXISTS platform_admin_permissions (
  admin_id VARCHAR(255) NOT NULL,
  permission VARCHAR(100) NOT NULL,
  PRIMARY KEY (admin_id, permission),
  INDEX idx_pap_admin (admin_id)
);

-- ============ members ============
CREATE TABLE IF NOT EXISTS members (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  name_ar VARCHAR(255),
  email VARCHAR(255),
  avatar VARCHAR(500),
  total_points INT DEFAULT 0,
  total_games INT DEFAULT 0,
  total_wins INT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by VARCHAR(255) NULL,
  updated_by VARCHAR(255) NULL,
  deleted_at DATETIME NULL,
  deleted_by VARCHAR(255) NULL,
  INDEX idx_members_deleted (deleted_at)
);

-- ============ member_points_history ============
CREATE TABLE IF NOT EXISTS member_points_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  member_id VARCHAR(255) NOT NULL,
  tournament_id INT,
  points INT DEFAULT 0,
  recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_mph_member (member_id)
);

-- ============ clubs ============
CREATE TABLE IF NOT EXISTS clubs (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  name_ar VARCHAR(255),
  logo VARCHAR(500),
  banner VARCHAR(500),
  tagline VARCHAR(500),
  tagline_ar VARCHAR(500),
  address VARCHAR(500),
  address_ar VARCHAR(500),
  phone VARCHAR(50),
  email VARCHAR(255),
  website VARCHAR(500),
  playtomic_venue_id VARCHAR(255),
  playtomic_api_key VARCHAR(500),
  status VARCHAR(50) DEFAULT 'active',
  store_enabled TINYINT(1) DEFAULT 0,
  current_tournament_id INT DEFAULT 1,
  active_tab VARCHAR(50) DEFAULT 'king',
  content_tab VARCHAR(50) DEFAULT 'standings',
  member_tab VARCHAR(50) DEFAULT 'members',
  tournament_state_text TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by VARCHAR(255) NULL,
  updated_by VARCHAR(255) NULL,
  deleted_at DATETIME NULL,
  deleted_by VARCHAR(255) NULL,
  INDEX idx_clubs_status (status),
  INDEX idx_clubs_deleted (deleted_at)
);

-- ============ member_clubs ============
CREATE TABLE IF NOT EXISTS member_clubs (
  member_id VARCHAR(255) NOT NULL,
  club_id VARCHAR(255) NOT NULL,
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (member_id, club_id),
  INDEX idx_mc_club (club_id)
);

-- ============ club_settings ============
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
  hero_bg_color VARCHAR(20),
  hero_bg_opacity INT,
  hero_title_color VARCHAR(20),
  hero_text_color VARCHAR(20),
  hero_stats_color VARCHAR(20),
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by VARCHAR(255) NULL
);

-- ============ club_social_links ============
CREATE TABLE IF NOT EXISTS club_social_links (
  id INT AUTO_INCREMENT PRIMARY KEY,
  club_id VARCHAR(255) NOT NULL,
  platform VARCHAR(50) NOT NULL,
  url VARCHAR(500) NOT NULL,
  sort_order INT DEFAULT 0,
  INDEX idx_csl_club (club_id)
);

-- ============ club_courts ============
CREATE TABLE IF NOT EXISTS club_courts (
  id VARCHAR(255) NOT NULL,
  club_id VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  name_ar VARCHAR(100),
  type VARCHAR(20) DEFAULT 'indoor',
  maintenance TINYINT(1) DEFAULT 0,
  image VARCHAR(500),
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
);

-- ============ club_admin_users ============
CREATE TABLE IF NOT EXISTS club_admin_users (
  id VARCHAR(255) NOT NULL,
  club_id VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  is_owner TINYINT(1) DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by VARCHAR(255) NULL,
  updated_by VARCHAR(255) NULL,
  deleted_at DATETIME NULL,
  deleted_by VARCHAR(255) NULL,
  PRIMARY KEY (id, club_id),
  INDEX idx_cau_club (club_id),
  INDEX idx_cau_deleted (deleted_at)
);

-- ============ club_admin_permissions ============
CREATE TABLE IF NOT EXISTS club_admin_permissions (
  admin_id VARCHAR(255) NOT NULL,
  club_id VARCHAR(255) NOT NULL,
  permission VARCHAR(100) NOT NULL,
  PRIMARY KEY (admin_id, club_id, permission),
  INDEX idx_cap_club (club_id)
);

-- ============ club_offers ============
CREATE TABLE IF NOT EXISTS club_offers (
  id VARCHAR(255) NOT NULL,
  club_id VARCHAR(255) NOT NULL,
  title VARCHAR(255),
  title_ar VARCHAR(255),
  description TEXT,
  description_ar TEXT,
  image VARCHAR(500),
  valid_from DATE,
  valid_until DATE,
  sort_order INT DEFAULT 0,
  extra_data_text TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by VARCHAR(255) NULL,
  updated_by VARCHAR(255) NULL,
  deleted_at DATETIME NULL,
  deleted_by VARCHAR(255) NULL,
  PRIMARY KEY (id, club_id),
  INDEX idx_co_club (club_id),
  INDEX idx_co_deleted (deleted_at)
);

-- ============ club_bookings ============
CREATE TABLE IF NOT EXISTS club_bookings (
  id VARCHAR(255) NOT NULL,
  club_id VARCHAR(255) NOT NULL,
  court_id VARCHAR(255),
  member_id VARCHAR(255),
  booking_date DATE,
  time_slot VARCHAR(50),
  status VARCHAR(50),
  extra_data_text TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by VARCHAR(255) NULL,
  updated_by VARCHAR(255) NULL,
  deleted_at DATETIME NULL,
  deleted_by VARCHAR(255) NULL,
  PRIMARY KEY (id, club_id),
  INDEX idx_cb_club (club_id),
  INDEX idx_cb_deleted (deleted_at)
);

-- ============ club_accounting ============
CREATE TABLE IF NOT EXISTS club_accounting (
  id INT AUTO_INCREMENT PRIMARY KEY,
  club_id VARCHAR(255) NOT NULL,
  entry_date DATE,
  description VARCHAR(500),
  amount DECIMAL(12,2) DEFAULT 0,
  entry_type VARCHAR(50),
  category VARCHAR(100),
  extra_data_text TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by VARCHAR(255) NULL,
  updated_by VARCHAR(255) NULL,
  deleted_at DATETIME NULL,
  deleted_by VARCHAR(255) NULL,
  INDEX idx_ca_club (club_id),
  INDEX idx_ca_deleted (deleted_at)
);

-- ============ club_tournament_types ============
CREATE TABLE IF NOT EXISTS club_tournament_types (
  id VARCHAR(255) NOT NULL,
  club_id VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  name_ar VARCHAR(255),
  description TEXT,
  description_ar TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  deleted_by VARCHAR(255) NULL,
  PRIMARY KEY (id, club_id),
  INDEX idx_ctt_club (club_id),
  INDEX idx_ctt_deleted (deleted_at)
);

-- ============ store_categories ============
CREATE TABLE IF NOT EXISTS store_categories (
  id VARCHAR(255) NOT NULL,
  club_id VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  name_ar VARCHAR(255),
  sort_order INT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  deleted_by VARCHAR(255) NULL,
  PRIMARY KEY (id, club_id),
  INDEX idx_sc_club (club_id)
);

-- ============ store_products ============
CREATE TABLE IF NOT EXISTS store_products (
  id VARCHAR(255) NOT NULL,
  club_id VARCHAR(255) NOT NULL,
  category_id VARCHAR(255),
  name VARCHAR(255),
  name_ar VARCHAR(255),
  price DECIMAL(12,2) DEFAULT 0,
  stock INT DEFAULT 0,
  image VARCHAR(500),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  deleted_by VARCHAR(255) NULL,
  PRIMARY KEY (id, club_id),
  INDEX idx_sp_club (club_id),
  INDEX idx_sp_category (category_id)
);

-- ============ store_sales ============
CREATE TABLE IF NOT EXISTS store_sales (
  id INT AUTO_INCREMENT PRIMARY KEY,
  club_id VARCHAR(255) NOT NULL,
  product_id VARCHAR(255),
  quantity INT DEFAULT 1,
  amount DECIMAL(12,2) DEFAULT 0,
  sale_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  extra_data_text TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  deleted_by VARCHAR(255) NULL,
  INDEX idx_ss_club (club_id)
);

-- ============ store_coupons ============
CREATE TABLE IF NOT EXISTS store_coupons (
  id VARCHAR(255) NOT NULL,
  club_id VARCHAR(255) NOT NULL,
  code VARCHAR(100) NOT NULL,
  discount DECIMAL(10,2) DEFAULT 0,
  valid_from DATE,
  valid_until DATE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  deleted_by VARCHAR(255) NULL,
  PRIMARY KEY (id, club_id),
  INDEX idx_sco_club (club_id)
);

-- ============ matches (بدون JSON - أعمدة صريحة) ============
CREATE TABLE IF NOT EXISTS matches (
  id INT AUTO_INCREMENT PRIMARY KEY,
  club_id VARCHAR(255) NOT NULL,
  tournament_type VARCHAR(50) NOT NULL,
  tournament_id INT NOT NULL,
  match_date DATE,
  court_id VARCHAR(255),
  team_a_score INT DEFAULT 0,
  team_b_score INT DEFAULT 0,
  winner_team VARCHAR(10),
  match_data_text TEXT,
  saved_at BIGINT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  deleted_by VARCHAR(255) NULL,
  INDEX idx_matches_club (club_id),
  INDEX idx_matches_tournament (club_id, tournament_type, tournament_id),
  INDEX idx_matches_saved_at (saved_at),
  INDEX idx_matches_deleted (deleted_at)
);

-- ============ match_teams ============
CREATE TABLE IF NOT EXISTS match_teams (
  id INT AUTO_INCREMENT PRIMARY KEY,
  match_id INT NOT NULL,
  team_label VARCHAR(10) NOT NULL,
  player1_id VARCHAR(255),
  player2_id VARCHAR(255),
  score INT DEFAULT 0,
  INDEX idx_mt_match (match_id)
);

-- ============ member_stats ============
CREATE TABLE IF NOT EXISTS member_stats (
  id INT AUTO_INCREMENT PRIMARY KEY,
  club_id VARCHAR(255) NOT NULL,
  member_id VARCHAR(255) NOT NULL,
  tournament_id INT NOT NULL,
  tournament_type VARCHAR(50),
  games_played INT DEFAULT 0,
  wins INT DEFAULT 0,
  points INT DEFAULT 0,
  stats_data_text TEXT,
  saved_at BIGINT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  deleted_by VARCHAR(255) NULL,
  INDEX idx_ms_club (club_id),
  INDEX idx_ms_member (member_id),
  INDEX idx_ms_tournament (club_id, tournament_id)
);

-- ============ tournament_summaries ============
CREATE TABLE IF NOT EXISTS tournament_summaries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  club_id VARCHAR(255) NOT NULL,
  tournament_type VARCHAR(50),
  tournament_id INT,
  summary_data_text TEXT,
  saved_at BIGINT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  deleted_by VARCHAR(255) NULL,
  INDEX idx_ts_club (club_id)
);

-- ============ password_reset_tokens ============
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  token VARCHAR(255) NOT NULL,
  user_type VARCHAR(50) NOT NULL,
  user_id VARCHAR(255),
  club_id VARCHAR(255),
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_prt_token (token),
  INDEX idx_prt_email (email)
);

SET FOREIGN_KEY_CHECKS = 1;
