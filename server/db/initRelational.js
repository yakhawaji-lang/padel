/**
 * تهيئة الجداول العلائقية الإضافية في u502561206_padel_db
 */
import { query } from './pool.js'

const RELATIONAL_TABLE_STMTS = [
  'CREATE TABLE IF NOT EXISTS platform_admin_permissions (admin_id VARCHAR(255) NOT NULL, permission VARCHAR(100) NOT NULL, PRIMARY KEY (admin_id, permission), INDEX idx_pap_admin (admin_id))',
  'CREATE TABLE IF NOT EXISTS club_admin_permissions (admin_id VARCHAR(255) NOT NULL, club_id VARCHAR(255) NOT NULL, permission VARCHAR(100) NOT NULL, PRIMARY KEY (admin_id, club_id, permission), INDEX idx_cap_club (club_id))',
  'CREATE TABLE IF NOT EXISTS club_social_links (id INT AUTO_INCREMENT PRIMARY KEY, club_id VARCHAR(255) NOT NULL, platform VARCHAR(50) NOT NULL, url VARCHAR(500) NOT NULL, sort_order INT DEFAULT 0, INDEX idx_csl_club (club_id))',
  'CREATE TABLE IF NOT EXISTS member_points_history (id INT AUTO_INCREMENT PRIMARY KEY, member_id VARCHAR(255) NOT NULL, tournament_id INT, points INT DEFAULT 0, recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP, INDEX idx_mph_member (member_id))',
  'CREATE TABLE IF NOT EXISTS store_categories (id VARCHAR(255) NOT NULL, club_id VARCHAR(255) NOT NULL, name VARCHAR(255), name_ar VARCHAR(255), sort_order INT DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, deleted_at DATETIME NULL, deleted_by VARCHAR(255) NULL, PRIMARY KEY (id, club_id), INDEX idx_sc_club (club_id))',
  'CREATE TABLE IF NOT EXISTS store_products (id VARCHAR(255) NOT NULL, club_id VARCHAR(255) NOT NULL, category_id VARCHAR(255), name VARCHAR(255), name_ar VARCHAR(255), price DECIMAL(12,2) DEFAULT 0, stock INT DEFAULT 0, image VARCHAR(500), created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, deleted_at DATETIME NULL, deleted_by VARCHAR(255) NULL, PRIMARY KEY (id, club_id), INDEX idx_sp_club (club_id), INDEX idx_sp_category (category_id))',
  'CREATE TABLE IF NOT EXISTS store_sales (id INT AUTO_INCREMENT PRIMARY KEY, club_id VARCHAR(255) NOT NULL, product_id VARCHAR(255), quantity INT DEFAULT 1, amount DECIMAL(12,2) DEFAULT 0, sale_date DATETIME DEFAULT CURRENT_TIMESTAMP, extra_data_text TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, deleted_at DATETIME NULL, deleted_by VARCHAR(255) NULL, INDEX idx_ss_club (club_id))',
  'CREATE TABLE IF NOT EXISTS store_coupons (id VARCHAR(255) NOT NULL, club_id VARCHAR(255) NOT NULL, code VARCHAR(100) NOT NULL, discount DECIMAL(10,2) DEFAULT 0, valid_from DATE, valid_until DATE, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, deleted_at DATETIME NULL, deleted_by VARCHAR(255) NULL, PRIMARY KEY (id, club_id), INDEX idx_sco_club (club_id))',
  'CREATE TABLE IF NOT EXISTS match_teams (id INT AUTO_INCREMENT PRIMARY KEY, match_id INT NOT NULL, team_label VARCHAR(10) NOT NULL, player1_id VARCHAR(255), player2_id VARCHAR(255), score INT DEFAULT 0, INDEX idx_mt_match (match_id))',
  'CREATE TABLE IF NOT EXISTS password_reset_tokens (id INT AUTO_INCREMENT PRIMARY KEY, email VARCHAR(255) NOT NULL, token VARCHAR(255) NOT NULL, user_type VARCHAR(50) NOT NULL, user_id VARCHAR(255), club_id VARCHAR(255), expires_at DATETIME NOT NULL, used_at DATETIME NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, INDEX idx_prt_token (token), INDEX idx_prt_email (email))'
]

export async function runInitRelational() {
  await query('SET FOREIGN_KEY_CHECKS = 0')
  const created = []
  for (const stmt of RELATIONAL_TABLE_STMTS) {
    try {
      await query(stmt)
      const match = stmt.match(/CREATE TABLE IF NOT EXISTS (\w+)/)
      if (match) created.push(match[1])
    } catch (e) {
      console.error('[init-relational] failed:', e.message)
      throw e
    }
  }
  await query('SET FOREIGN_KEY_CHECKS = 1')

  for (const tbl of ['matches', 'member_stats', 'tournament_summaries']) {
    try {
      await query(`ALTER TABLE \`${tbl}\` ADD COLUMN deleted_at DATETIME NULL`)
    } catch (e) {
      if (!e.message?.includes('Duplicate column')) {}
    }
    try {
      await query(`ALTER TABLE \`${tbl}\` ADD COLUMN deleted_by VARCHAR(255) NULL`)
    } catch (e) {
      if (!e.message?.includes('Duplicate column')) {}
    }
  }
  return { created }
}
