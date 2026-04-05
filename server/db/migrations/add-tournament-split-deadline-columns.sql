-- مهلة دفع المشاركين لحجوزات King of the Court و Social Tournament (منفصلة عن مهلة التقسيم العامة).
-- التطبيق يُضيف الأعمدة تلقائياً عند التشغيل عبر ensureClubSettingsBookingColumns().
-- للتشغيل اليدوي في phpMyAdmin (تجاهل الخطأ إن وُجد العمود مسبقاً):

ALTER TABLE club_settings ADD COLUMN tournament_king_split_payment_deadline_minutes INT DEFAULT 30;
ALTER TABLE club_settings ADD COLUMN tournament_social_split_payment_deadline_minutes INT DEFAULT 30;
