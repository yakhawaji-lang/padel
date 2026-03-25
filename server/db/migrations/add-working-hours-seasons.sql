-- ============================================================================
-- مواسم أوقات العمل + فترات متعددة (ومنها الفترات الليلية 16:00→04:00)
-- Club settings: working_hours_seasons (JSON)
-- ============================================================================
-- ملف المشروع (للمرجع): padel/server/db/migrations/add-working-hours-seasons.sql
-- على GitHub (main):
--   https://github.com/yakhawaji-lang/padel/blob/main/server/db/migrations/add-working-hours-seasons.sql
--
-- الجدول: club_settings
-- العمود:  working_hours_seasons  JSON  (مصفوفة مواسم في الـ API: workingHoursSeasons)
-- شكل JSON:
--   [{"id":"default","label":"","startDate":"01-01","endDate":"12-31",
--     "periods":[{"open":"16:00","close":"04:00"}]}]
-- أعمدة opening_time / closing_time تبقى للتوافق (أبكر فتح / آخر إغلاق تقريبي).
--
-- طريقة التشغيل (MySQL / MariaDB / phpMyAdmin):
--   نفّذ الأمر أدناه مرة واحدة على قاعدة padel_db (أو اسم قاعدتك).
--   إن ظهر Duplicate column name فالعمود موجود مسبقاً — تجاهل.
--   أو شغّل الخادم: يُضاف العمود تلقائياً عبر ensureClubSettingsBookingColumns().
-- ============================================================================

ALTER TABLE club_settings
  ADD COLUMN working_hours_seasons JSON NULL;

-- مثال (اختياري): تعبئة افتراضية لنادٍ معيّن بعد الحفظ من لوحة الإدارة أو يدوياً:
-- UPDATE club_settings SET working_hours_seasons = JSON_ARRAY(
--   JSON_OBJECT(
--     'id', 'default',
--     'label', '',
--     'startDate', '01-01',
--     'endDate', '12-31',
--     'periods', JSON_ARRAY(JSON_OBJECT('open', '16:00', 'close', '04:00'))
--   )
-- ) WHERE club_id = 'YOUR_CLUB_ID';
