-- ============================================================================
-- PlayTix — نظام الفواتير والمدفوعات لكل نادي (Invoicing v1)
-- تنفيذ على u502561206_padel_db (أو قاعدتك) عبر phpMyAdmin → SQL أو Import
-- ============================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- تسلسل أرقام الفواتير لكل نادي وكل شهر (YYYYMM)
CREATE TABLE IF NOT EXISTS club_invoice_seq (
  club_id VARCHAR(255) NOT NULL,
  period CHAR(6) NOT NULL COMMENT 'YYYYMM',
  last_seq INT NOT NULL DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (club_id, period),
  INDEX idx_cis_period (period)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- رأس الفاتورة
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

-- بنود الفاتورة
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

-- سجل المقبوضات (يرتبط بفاتورة؛ توسعة لاحقة: تخصيص جزئي متعدد)
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

-- ============================================================================
-- نهاية التهجير — بعد التنفيذ أعد تشغيل تطبيق Node إن لزم
-- ============================================================================
