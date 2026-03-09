-- ============================================================================
-- PlayTix - استعلامات u502561206_padel_db الشاملة
-- جميع استعلامات النظام لكل البيانات
-- ============================================================================

-- ==================== 1. app_settings ====================
-- جلب إعداد واحد
SELECT `key`, value_text, value_type FROM app_settings WHERE `key` = ?;
-- جلب إعدادات متعددة
SELECT `key`, value_text, value_type FROM app_settings WHERE `key` IN (?, ?, ?);
-- حفظ/تحديث إعداد
INSERT INTO app_settings (`key`, value_text, value_type) VALUES (?, ?, ?)
ON DUPLICATE KEY UPDATE value_text = VALUES(value_text), value_type = VALUES(value_type), updated_at = NOW();
-- حذف إعداد
DELETE FROM app_settings WHERE `key` = ?;

-- ==================== 2. platform_admins ====================
-- جلب كل المدراء النشطين
SELECT id, email, password_hash, role, created_at, updated_at
FROM platform_admins WHERE deleted_at IS NULL ORDER BY email;
-- جلب مدير بالبريد
SELECT id, email, password_hash, role FROM platform_admins WHERE email = ? AND deleted_at IS NULL;
-- جلب مدير بالمعرف
SELECT * FROM platform_admins WHERE id = ? AND deleted_at IS NULL;
-- إضافة مدير
INSERT INTO platform_admins (id, email, password_hash, role, created_by)
VALUES (?, ?, ?, ?, ?);
-- تحديث مدير
UPDATE platform_admins SET email=?, password_hash=?, role=?, updated_at=NOW(), updated_by=? WHERE id=?;
-- حذف مؤقت
UPDATE platform_admins SET deleted_at=NOW(), deleted_by=? WHERE id=?;

-- ==================== 3. platform_admin_permissions ====================
-- جلب صلاحيات مدير
SELECT permission FROM platform_admin_permissions WHERE admin_id = ?;
-- إضافة صلاحية
INSERT IGNORE INTO platform_admin_permissions (admin_id, permission) VALUES (?, ?);
-- حذف صلاحيات مدير
DELETE FROM platform_admin_permissions WHERE admin_id = ?;
-- تعيين صلاحيات (بعد حذف القديمة)
DELETE FROM platform_admin_permissions WHERE admin_id = ?;
INSERT INTO platform_admin_permissions (admin_id, permission) VALUES (?, ?), (?, ?);

-- ==================== 4. members ====================
-- جلب كل الأعضاء النشطين
SELECT id, name, name_ar, email, avatar, total_points, total_games, total_wins
FROM members WHERE deleted_at IS NULL ORDER BY name;
-- جلب عضو بالمعرف
SELECT * FROM members WHERE id = ? AND deleted_at IS NULL;
-- جلب أعضاء نادي
SELECT m.* FROM members m
JOIN member_clubs mc ON m.id = mc.member_id
WHERE mc.club_id = ? AND m.deleted_at IS NULL;
-- إضافة عضو
INSERT INTO members (id, name, name_ar, email, avatar, total_points, total_games, total_wins, created_by)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
-- تحديث عضو
UPDATE members SET name=?, name_ar=?, email=?, avatar=?, total_points=?, total_games=?, total_wins=?, updated_at=NOW(), updated_by=? WHERE id=?;
-- حذف مؤقت
UPDATE members SET deleted_at=NOW(), deleted_by=? WHERE id=?;

-- ==================== 5. member_clubs ====================
-- جلب نوادي العضو
SELECT club_id FROM member_clubs WHERE member_id = ?;
-- ربط عضو بنادي
INSERT IGNORE INTO member_clubs (member_id, club_id) VALUES (?, ?);
-- فك ربط عضو من نادي
DELETE FROM member_clubs WHERE member_id = ? AND club_id = ?;
-- حذف كل علاقات العضو
DELETE FROM member_clubs WHERE member_id = ?;
-- عدد الأعضاء لكل نادٍ
SELECT club_id, COUNT(*) as member_count FROM member_clubs GROUP BY club_id;

-- ==================== 6. clubs ====================
-- جلب كل الأندية النشطة
SELECT * FROM clubs WHERE deleted_at IS NULL ORDER BY name;
-- جلب نادي بالمعرف
SELECT * FROM clubs WHERE id = ? AND deleted_at IS NULL;
-- جلب أندية بانتظار الموافقة
SELECT * FROM clubs WHERE status = 'pending' AND deleted_at IS NULL;
-- إضافة نادٍ
INSERT INTO clubs (id, name, name_ar, logo, banner, tagline, tagline_ar, address, address_ar, phone, email, website, playtomic_venue_id, playtomic_api_key, status, store_enabled, current_tournament_id, active_tab, content_tab, member_tab, created_by)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
-- تحديث نادٍ
UPDATE clubs SET name=?, name_ar=?, logo=?, banner=?, tagline=?, tagline_ar=?, address=?, address_ar=?, phone=?, email=?, website=?, playtomic_venue_id=?, playtomic_api_key=?, status=?, store_enabled=?, current_tournament_id=?, active_tab=?, content_tab=?, member_tab=?, tournament_state_text=?, updated_at=NOW(), updated_by=? WHERE id=?;
-- حذف مؤقت
UPDATE clubs SET deleted_at=NOW(), deleted_by=? WHERE id=?;

-- ==================== 7. club_settings ====================
-- جلب إعدادات نادٍ
SELECT * FROM club_settings WHERE club_id = ?;
-- حفظ/تحديث إعدادات
INSERT INTO club_settings (club_id, default_language, timezone, currency, booking_duration, max_booking_advance, cancellation_policy, opening_time, closing_time, header_bg_color, header_text_color, hero_bg_color, hero_bg_opacity, hero_title_color, hero_text_color, hero_stats_color, updated_by)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON DUPLICATE KEY UPDATE default_language=VALUES(default_language), timezone=VALUES(timezone), currency=VALUES(currency), booking_duration=VALUES(booking_duration), max_booking_advance=VALUES(max_booking_advance), cancellation_policy=VALUES(cancellation_policy), opening_time=VALUES(opening_time), closing_time=VALUES(closing_time), header_bg_color=VALUES(header_bg_color), header_text_color=VALUES(header_text_color), hero_bg_color=VALUES(hero_bg_color), hero_bg_opacity=VALUES(hero_bg_opacity), hero_title_color=VALUES(hero_title_color), hero_text_color=VALUES(hero_text_color), hero_stats_color=VALUES(hero_stats_color), updated_at=NOW(), updated_by=VALUES(updated_by);

-- ==================== 8. club_social_links ====================
-- جلب روابط السوشيال لنادٍ
SELECT platform, url, sort_order FROM club_social_links WHERE club_id = ? ORDER BY sort_order;
-- إضافة رابط
INSERT INTO club_social_links (club_id, platform, url, sort_order) VALUES (?, ?, ?, ?);
-- حذف روابط نادٍ
DELETE FROM club_social_links WHERE club_id = ?;

-- ==================== 9. club_courts ====================
-- جلب ملاعب نادٍ
SELECT * FROM club_courts WHERE club_id = ? AND deleted_at IS NULL ORDER BY sort_order;
-- إضافة ملعب
INSERT INTO club_courts (id, club_id, name, name_ar, type, maintenance, image, sort_order, created_by)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
ON DUPLICATE KEY UPDATE name=VALUES(name), name_ar=VALUES(name_ar), type=VALUES(type), maintenance=VALUES(maintenance), image=VALUES(image), sort_order=VALUES(sort_order), updated_at=NOW(), updated_by=VALUES(updated_by), deleted_at=NULL, deleted_by=NULL;
-- حذف مؤقت ملعب
UPDATE club_courts SET deleted_at=NOW(), deleted_by=? WHERE club_id=? AND id=?;

-- ==================== 10. club_admin_users ====================
-- جلب مدراء نادٍ
SELECT * FROM club_admin_users WHERE club_id = ? AND deleted_at IS NULL;
-- التحقق من دخول مدير نادٍ
SELECT id, email, password_hash, is_owner FROM club_admin_users WHERE club_id = ? AND email = ? AND deleted_at IS NULL;
-- إضافة مدير نادٍ
INSERT INTO club_admin_users (id, club_id, email, password_hash, is_owner, created_by)
VALUES (?, ?, ?, ?, ?, ?)
ON DUPLICATE KEY UPDATE email=VALUES(email), password_hash=VALUES(password_hash), is_owner=VALUES(is_owner), updated_at=NOW(), updated_by=VALUES(updated_by), deleted_at=NULL, deleted_by=NULL;
-- حذف مؤقت
UPDATE club_admin_users SET deleted_at=NOW(), deleted_by=? WHERE club_id=? AND id=?;

-- ==================== 11. club_admin_permissions ====================
-- جلب صلاحيات مدير نادٍ
SELECT permission FROM club_admin_permissions WHERE admin_id = ? AND club_id = ?;
-- تعيين صلاحيات
DELETE FROM club_admin_permissions WHERE admin_id = ? AND club_id = ?;
INSERT INTO club_admin_permissions (admin_id, club_id, permission) VALUES (?, ?, ?), (?, ?, ?);

-- ==================== 12. club_offers ====================
-- جلب عروض نادٍ
SELECT * FROM club_offers WHERE club_id = ? AND deleted_at IS NULL ORDER BY sort_order;
-- إضافة عرض
INSERT INTO club_offers (id, club_id, title, title_ar, description, description_ar, image, valid_from, valid_until, sort_order, extra_data_text, created_by)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON DUPLICATE KEY UPDATE title=VALUES(title), title_ar=VALUES(title_ar), description=VALUES(description), description_ar=VALUES(description_ar), image=VALUES(image), valid_from=VALUES(valid_from), valid_until=VALUES(valid_until), sort_order=VALUES(sort_order), extra_data_text=VALUES(extra_data_text), updated_at=NOW(), updated_by=VALUES(updated_by), deleted_at=NULL, deleted_by=NULL;
-- حذف مؤقت
UPDATE club_offers SET deleted_at=NOW(), deleted_by=? WHERE club_id=? AND id=?;

-- ==================== 13. club_bookings ====================
-- جلب حجوزات نادٍ
SELECT * FROM club_bookings WHERE club_id = ? AND deleted_at IS NULL ORDER BY booking_date, time_slot;
-- جلب حجوزات تاريخ
SELECT * FROM club_bookings WHERE club_id = ? AND booking_date = ? AND deleted_at IS NULL;
-- إضافة حجز
INSERT INTO club_bookings (id, club_id, court_id, member_id, booking_date, time_slot, status, extra_data_text, created_by)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
ON DUPLICATE KEY UPDATE court_id=VALUES(court_id), member_id=VALUES(member_id), booking_date=VALUES(booking_date), time_slot=VALUES(time_slot), status=VALUES(status), extra_data_text=VALUES(extra_data_text), updated_at=NOW(), updated_by=VALUES(updated_by), deleted_at=NULL, deleted_by=NULL;
-- حذف مؤقت
UPDATE club_bookings SET deleted_at=NOW(), deleted_by=? WHERE club_id=? AND id=?;

-- ==================== 14. club_accounting ====================
-- جلب محاسبة نادٍ
SELECT * FROM club_accounting WHERE club_id = ? AND deleted_at IS NULL ORDER BY entry_date DESC;
-- جلب إيرادات نادٍ
SELECT SUM(amount) as total FROM club_accounting WHERE club_id = ? AND entry_type = 'income' AND deleted_at IS NULL;
-- جلب مصروفات نادٍ
SELECT SUM(amount) as total FROM club_accounting WHERE club_id = ? AND entry_type = 'expense' AND deleted_at IS NULL;
-- إضافة سجل محاسبة
INSERT INTO club_accounting (club_id, entry_date, description, amount, entry_type, category, extra_data_text, created_by)
VALUES (?, ?, ?, ?, ?, ?, ?, ?);
-- تحديث سجل
UPDATE club_accounting SET entry_date=?, description=?, amount=?, entry_type=?, category=?, extra_data_text=?, updated_at=NOW(), updated_by=? WHERE id=? AND club_id=?;
-- حذف مؤقت
UPDATE club_accounting SET deleted_at=NOW(), deleted_by=? WHERE id=?;

-- ==================== 15. club_tournament_types ====================
-- جلب أنواع البطولات
SELECT * FROM club_tournament_types WHERE club_id = ? AND deleted_at IS NULL;
-- إضافة نوع
INSERT INTO club_tournament_types (id, club_id, name, name_ar, description, description_ar)
VALUES (?, ?, ?, ?, ?, ?)
ON DUPLICATE KEY UPDATE name=VALUES(name), name_ar=VALUES(name_ar), description=VALUES(description), description_ar=VALUES(description_ar), updated_at=NOW(), deleted_at=NULL, deleted_by=NULL;
-- حذف مؤقت
UPDATE club_tournament_types SET deleted_at=NOW(), deleted_by=? WHERE club_id=? AND id=?;

-- ==================== 16. matches ====================
-- جلب مباريات نادٍ
SELECT id, club_id, tournament_type, tournament_id, match_date, court_id, team_a_score, team_b_score, winner_team, match_data_text, saved_at
FROM matches WHERE club_id = ? AND deleted_at IS NULL ORDER BY saved_at ASC;
-- جلب مباريات بطولة
SELECT * FROM matches WHERE club_id = ? AND tournament_type = ? AND tournament_id = ? AND deleted_at IS NULL ORDER BY saved_at ASC;
-- إضافة مباراة
INSERT INTO matches (club_id, tournament_type, tournament_id, match_date, court_id, team_a_score, team_b_score, winner_team, match_data_text, saved_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
-- حذف مباريات بطولة
DELETE FROM matches WHERE club_id = ? AND tournament_id = ? AND tournament_type = ?;
-- حذف مؤقت مباريات تاريخ
UPDATE matches SET deleted_at=NOW(), deleted_by=? WHERE club_id = ? AND tournament_type = ? AND saved_at >= ? AND saved_at <= ?;

-- ==================== 17. member_stats ====================
-- جلب إحصائيات عضو
SELECT * FROM member_stats WHERE member_id = ? AND deleted_at IS NULL;
-- جلب إحصائيات نادٍ
SELECT * FROM member_stats WHERE club_id = ? AND deleted_at IS NULL;
-- جلب إحصائيات بطولة
SELECT * FROM member_stats WHERE club_id = ? AND tournament_id = ? AND deleted_at IS NULL;
-- حفظ إحصائيات
INSERT INTO member_stats (club_id, member_id, tournament_id, tournament_type, games_played, wins, points, stats_data_text, saved_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
ON DUPLICATE KEY UPDATE games_played=VALUES(games_played), wins=VALUES(wins), points=VALUES(points), stats_data_text=VALUES(stats_data_text), saved_at=VALUES(saved_at);

-- ==================== 18. tournament_summaries ====================
-- جلب ملخصات بطولة نادٍ
SELECT * FROM tournament_summaries WHERE club_id = ? AND deleted_at IS NULL;
-- حفظ ملخص
INSERT INTO tournament_summaries (club_id, tournament_type, tournament_id, summary_data_text, saved_at)
VALUES (?, ?, ?, ?, ?);

-- ==================== 19. audit_log ====================
-- تسجيل عملية
INSERT INTO audit_log (table_name, record_id, action, actor_type, actor_id, actor_name, club_id, old_value_text, new_value_text, ip_address)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
-- جلب سجل جدول
SELECT * FROM audit_log WHERE table_name = ? ORDER BY created_at DESC LIMIT 100;
-- جلب سجل سجل معين
SELECT * FROM audit_log WHERE table_name = ? AND record_id = ? ORDER BY created_at DESC;
-- جلب سجل مدخل
SELECT * FROM audit_log WHERE actor_type = ? AND actor_id = ? ORDER BY created_at DESC LIMIT 50;
-- جلب سجل نادٍ
SELECT * FROM audit_log WHERE club_id = ? ORDER BY created_at DESC LIMIT 100;

-- ==================== 20. تقارير وإحصائيات ====================
-- إجمالي الأندية
SELECT COUNT(*) as total FROM clubs WHERE deleted_at IS NULL;
-- إجمالي الأعضاء
SELECT COUNT(*) as total FROM members WHERE deleted_at IS NULL;
-- إجمالي المباريات
SELECT COUNT(*) as total FROM matches WHERE deleted_at IS NULL;
-- أعلى الأعضاء نقاطاً
SELECT m.id, m.name, m.total_points, m.total_games, m.total_wins
FROM members m WHERE m.deleted_at IS NULL ORDER BY m.total_points DESC LIMIT 10;
-- إيرادات الأندية
SELECT c.id, c.name, COALESCE(SUM(a.amount), 0) as total_income
FROM clubs c LEFT JOIN club_accounting a ON c.id = a.club_id AND a.entry_type = 'income' AND a.deleted_at IS NULL
WHERE c.deleted_at IS NULL GROUP BY c.id, c.name;
-- عدد المباريات لكل نادٍ
SELECT club_id, COUNT(*) as match_count FROM matches WHERE deleted_at IS NULL GROUP BY club_id;
-- عدد الأعضاء لكل نادٍ
SELECT club_id, COUNT(*) as member_count FROM member_clubs GROUP BY club_id;
-- آخر العمليات (audit)
SELECT al.table_name, al.record_id, al.action, al.actor_type, al.actor_name, al.created_at
FROM audit_log al ORDER BY al.created_at DESC LIMIT 20;

-- ==================== 21. Purge (حذف السجلات المحذوفة بعد 3 أشهر) ====================
DELETE FROM platform_admins WHERE deleted_at IS NOT NULL AND deleted_at < DATE_SUB(NOW(), INTERVAL 3 MONTH);
DELETE FROM members WHERE deleted_at IS NOT NULL AND deleted_at < DATE_SUB(NOW(), INTERVAL 3 MONTH);
DELETE FROM clubs WHERE deleted_at IS NOT NULL AND deleted_at < DATE_SUB(NOW(), INTERVAL 3 MONTH);
DELETE FROM club_courts WHERE deleted_at IS NOT NULL AND deleted_at < DATE_SUB(NOW(), INTERVAL 3 MONTH);
DELETE FROM club_admin_users WHERE deleted_at IS NOT NULL AND deleted_at < DATE_SUB(NOW(), INTERVAL 3 MONTH);
DELETE FROM club_offers WHERE deleted_at IS NOT NULL AND deleted_at < DATE_SUB(NOW(), INTERVAL 3 MONTH);
DELETE FROM club_bookings WHERE deleted_at IS NOT NULL AND deleted_at < DATE_SUB(NOW(), INTERVAL 3 MONTH);
DELETE FROM club_accounting WHERE deleted_at IS NOT NULL AND deleted_at < DATE_SUB(NOW(), INTERVAL 3 MONTH);
DELETE FROM club_tournament_types WHERE deleted_at IS NOT NULL AND deleted_at < DATE_SUB(NOW(), INTERVAL 3 MONTH);
DELETE FROM matches WHERE deleted_at IS NOT NULL AND deleted_at < DATE_SUB(NOW(), INTERVAL 3 MONTH);
DELETE FROM member_stats WHERE deleted_at IS NOT NULL AND deleted_at < DATE_SUB(NOW(), INTERVAL 3 MONTH);
DELETE FROM tournament_summaries WHERE deleted_at IS NOT NULL AND deleted_at < DATE_SUB(NOW(), INTERVAL 3 MONTH);
