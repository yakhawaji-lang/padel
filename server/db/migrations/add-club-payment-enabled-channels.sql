-- ============================================================================
-- إعدادات قنوات الدفع لكل نادي (مستقلة عن الأندية الأخرى)
-- Club settings: payment_enabled_channels (JSON) → في الـ API: paymentEnabledChannels
-- ============================================================================
-- ملف المشروع: server/db/migrations/add-club-payment-enabled-channels.sql
-- على GitHub:
--   https://github.com/yakhawaji-lang/padel/blob/main/server/db/migrations/add-club-payment-enabled-channels.sql
--
-- شكل JSON (أمثلة):
--   {"at_club":true,"credit_card":false,"mada":false,"split":true}
-- القيم الفعّالة = تقاطع مع إعدادات المنصة (platform_payment_gateways).
--
-- طريقة التشغيل (MySQL / MariaDB):
--   نفّذ الأمر أدناه مرة واحدة. إذا ظهر Duplicate column name فالمهمة منجزة.
--   أو شغّل الخادم: يُضاف العمود تلقائياً عبر ensureClubSettingsBookingColumns().
-- ============================================================================

ALTER TABLE club_settings
  ADD COLUMN payment_enabled_channels JSON NULL;
