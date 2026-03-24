-- إضافة عمود وقت الاستعداد بين الحجوزات (دقائق)
-- يحدد فترة بعد كل حجز قبل بدء الحجز التالي
ALTER TABLE club_settings ADD COLUMN preparation_time_minutes INT DEFAULT 0;
