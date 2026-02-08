-- ============================================================================
-- PlayTix Normalized Schema - u502561206_padel_db
-- جداول منظمة مع علاقات صريحة، حذف مؤقت، وتدقيق عمليات
-- ============================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- ============ audit_log (يُنشأ أولاً - لا يعتمد على جداول أخرى) ============
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
);

-- ============ platform_admins ============
CREATE TABLE IF NOT EXISTS platform_admins (
  id VARCHAR(255) PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'admin',
  permissions JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by VARCHAR(255) NULL,
  updated_by VARCHAR(255) NULL,
  deleted_at DATETIME NULL,
  deleted_by VARCHAR(255) NULL,
  INDEX idx_pa_email (email),
  INDEX idx_pa_deleted (deleted_at)
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
  points_history JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by VARCHAR(255) NULL,
  updated_by VARCHAR(255) NULL,
  deleted_at DATETIME NULL,
  deleted_by VARCHAR(255) NULL,
  INDEX idx_members_deleted (deleted_at)
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
  tournament_data JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by VARCHAR(255) NULL,
  updated_by VARCHAR(255) NULL,
  deleted_at DATETIME NULL,
  deleted_by VARCHAR(255) NULL,
  INDEX idx_clubs_status (status),
  INDEX idx_clubs_deleted (deleted_at)
);

-- ============ member_clubs (many-to-many) ============
CREATE TABLE IF NOT EXISTS member_clubs (
  member_id VARCHAR(255) NOT NULL,
  club_id VARCHAR(255) NOT NULL,
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (member_id, club_id),
  INDEX idx_mc_club (club_id)
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
  social_links JSON,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by VARCHAR(255) NULL
);

-- ============ club_admin_users ============
CREATE TABLE IF NOT EXISTS club_admin_users (
  id VARCHAR(255) NOT NULL,
  club_id VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  is_owner TINYINT(1) DEFAULT 0,
  permissions JSON,
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
  data JSON,
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
  data JSON,
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
  data JSON,
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

-- ============ club_store (JSON للحفاظ على مرونة المتجر) ============
CREATE TABLE IF NOT EXISTS club_store (
  club_id VARCHAR(255) PRIMARY KEY,
  data JSON NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by VARCHAR(255) NULL
);

-- ============ تحديث matches - إضافة soft delete ============
-- يتم إنشاؤها من initDb - نضيف الأعمدة لاحقاً عبر ALTER إن وُجدت

-- ============ تحديث member_stats - إضافة soft delete ============

-- ============ تحديث tournament_summaries - إضافة soft delete ============

SET FOREIGN_KEY_CHECKS = 1;
