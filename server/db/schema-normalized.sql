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
  mobile VARCHAR(50),
  password_hash VARCHAR(255),
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
  is_coach TINYINT(1) DEFAULT 0,
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
  booking_prices JSON,
  working_hours_seasons JSON NULL,
  payment_enabled_channels JSON NULL,
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

-- ============ booking_payment_shares (مشاركة الدفع للحجوزات) ============
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
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_bps_booking (booking_id, club_id),
  INDEX idx_bps_club (club_id)
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

-- ============ فواتير ومدفوعات لكل نادي (Invoicing v1) — انسخ من migrations/add-club-invoicing-system.sql إن لزم ============
CREATE TABLE IF NOT EXISTS club_invoice_seq (
  club_id VARCHAR(255) NOT NULL,
  period CHAR(6) NOT NULL COMMENT 'YYYYMM',
  last_seq INT NOT NULL DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (club_id, period),
  INDEX idx_cis_period (period)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS club_invoices (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  public_id CHAR(36) NOT NULL COMMENT 'UUID for external references',
  club_id VARCHAR(255) NOT NULL,
  invoice_number VARCHAR(64) NOT NULL,
  status ENUM('draft','issued','partially_paid','paid','void','cancelled') NOT NULL DEFAULT 'issued',
  currency VARCHAR(10) NOT NULL DEFAULT 'SAR',
  subtotal DECIMAL(14,2) NOT NULL DEFAULT 0,
  tax_total DECIMAL(14,2) NOT NULL DEFAULT 0,
  total DECIMAL(14,2) NOT NULL DEFAULT 0,
  amount_paid DECIMAL(14,2) NOT NULL DEFAULT 0,
  balance_due DECIMAL(14,2) NOT NULL DEFAULT 0,
  customer_member_id VARCHAR(255) NULL,
  customer_name VARCHAR(255) NULL,
  customer_phone VARCHAR(50) NULL,
  source_type VARCHAR(32) NULL COMMENT 'booking_share | booking_full | manual | tournament | store | other',
  source_ref VARCHAR(255) NULL COMMENT 'e.g. bookingId:shareId',
  idempotency_key VARCHAR(191) NULL,
  notes TEXT NULL,
  meta JSON NULL,
  issued_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  due_at DATETIME NULL,
  paid_at DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  UNIQUE KEY uk_ci_club_number (club_id, invoice_number),
  UNIQUE KEY uk_ci_idempotency (idempotency_key),
  INDEX idx_ci_club_issued (club_id, issued_at),
  INDEX idx_ci_club_status (club_id, status),
  INDEX idx_ci_public (public_id),
  INDEX idx_ci_deleted (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS club_invoice_lines (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  invoice_id BIGINT NOT NULL,
  line_no INT NOT NULL DEFAULT 1,
  description VARCHAR(500) NOT NULL,
  description_ar VARCHAR(500) NULL,
  quantity DECIMAL(14,4) NOT NULL DEFAULT 1.0000,
  unit_price DECIMAL(14,2) NOT NULL DEFAULT 0,
  tax_rate DECIMAL(8,4) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  line_total DECIMAL(14,2) NOT NULL DEFAULT 0,
  meta JSON NULL,
  UNIQUE KEY uk_ci_line (invoice_id, line_no),
  INDEX idx_cil_invoice (invoice_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS club_payments (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  club_id VARCHAR(255) NOT NULL,
  invoice_id BIGINT NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'SAR',
  method VARCHAR(32) NOT NULL COMMENT 'electronic | at_club | cash | card | mada | bank_transfer | other',
  external_ref VARCHAR(255) NULL,
  idempotency_key VARCHAR(191) NULL,
  member_id VARCHAR(255) NULL,
  recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  meta JSON NULL,
  UNIQUE KEY uk_cp_idempotency (idempotency_key),
  INDEX idx_cp_club_time (club_id, recorded_at),
  INDEX idx_cp_invoice (invoice_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
