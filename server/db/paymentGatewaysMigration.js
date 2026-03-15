/**
 * Platform Payment Gateways migration - run via /api/init-db/migrate-payment-gateways
 */
import { query } from './pool.js'

export async function runPaymentGatewaysMigration() {
  await query(`
    CREATE TABLE IF NOT EXISTS platform_payment_gateways (
      id INT AUTO_INCREMENT PRIMARY KEY,
      gateway_key VARCHAR(50) NOT NULL UNIQUE,
      enabled TINYINT(1) DEFAULT 1,
      config_json TEXT,
      display_name VARCHAR(100),
      display_name_ar VARCHAR(100),
      sort_order INT DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
  await query(`
    INSERT INTO platform_payment_gateways (gateway_key, enabled, config_json, display_name, display_name_ar, sort_order) VALUES
    ('at_club', 1, '{"description":"Pay at club with cash or card"}', 'At club', 'الدفع في النادي', 1),
    ('credit_card', 0, '{"provider":"stripe","publishableKey":"","secretKey":"","webhookSecret":"","description":"Online payment via Visa, Mastercard"}', 'Credit card', 'البطاقة الائتمانية', 2),
    ('mada', 0, '{"merchantId":"","apiKey":"","gatewayId":"","description":"متاب - بطاقة الدفع السعودية"}', 'Mada', 'متاب', 3),
    ('split', 1, '{"deadlineMinutes":30,"description":"Split payment with other participants"}', 'Split payment', 'تقسيم المبلغ', 4)
    ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP
  `)
}
