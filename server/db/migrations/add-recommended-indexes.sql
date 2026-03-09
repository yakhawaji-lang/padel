-- فهارس موصى بها لأداء أفضل واستعلامات الحجوزات والعضويات
-- تشغيل في phpMyAdmin على قاعدة padel_db (تجاهل خطأ "Duplicate key" إن ظهر)

-- حجوزات: استعلامات حسب النادي والتاريخ
ALTER TABLE club_bookings ADD INDEX idx_cb_club_date (club_id, booking_date);
ALTER TABLE club_bookings ADD INDEX idx_cb_club_deleted (club_id, deleted_at);

-- أقفال الحجز: انتهاء الصلاحية والبحث حسب النادي/التاريخ
ALTER TABLE booking_slot_locks ADD INDEX idx_bsl_club_date (club_id, booking_date);
ALTER TABLE booking_slot_locks ADD INDEX idx_bsl_expires (expires_at);
