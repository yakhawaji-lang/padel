-- Add Geidea entry to platform_payment_gateways (idempotent).
-- Run after the table exists. Safe to re-run.

INSERT INTO platform_payment_gateways
  (gateway_key, enabled, config_json, display_name, display_name_ar, sort_order)
VALUES
  ('geidea', 0,
   '{"provider":"geidea","publicKey":"","apiPassword":"","mode":"test","callbackUrl":"","description":"Geidea Checkout V2 — auto-detects Mada / Visa / Mastercard"}',
   'Electronic payment (Geidea)', 'الدفع الإلكتروني (Geidea)', 4)
ON DUPLICATE KEY UPDATE
  updated_at = CURRENT_TIMESTAMP;

SELECT 'geidea gateway row added' AS status;
