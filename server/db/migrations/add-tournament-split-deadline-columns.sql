-- مهلة دفع المشاركين لحجوزات King of the Court و Social Tournament (منفصلة عن مهلة التقسيم العامة).
-- التطبيق يُضيف الأعمدة تلقائياً عند تشغيل الخادم عبر ensureClubSettingsBookingColumns().
--
-- للتشغيل اليدوي في phpMyAdmin: IF NOT EXISTS يتجنّب خطأ #1060 إن وُجد العمود مسبقاً
-- (مدعوم في MariaDB 10.3.3+ — غالباً على Hostinger). إن رفض السيرفر الصيغة، نفّذ سطراً واحداً
-- للعمود الناقص فقط، أو تجاهل خطأ Duplicate column.

ALTER TABLE club_settings
  ADD COLUMN IF NOT EXISTS tournament_king_split_payment_deadline_minutes INT DEFAULT 30;

ALTER TABLE club_settings
  ADD COLUMN IF NOT EXISTS tournament_social_split_payment_deadline_minutes INT DEFAULT 30;
