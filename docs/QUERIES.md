# استعلامات u502561206_padel_db

**جميع استعلامات النظام — ملف مرجعي كامل**

- **`server/db/queries.sql`** — استعلامات SQL للنصوص
- **`server/db/queries.js`** — دوال قابلة للاستدعاء من التطبيق

---

## فهرس الاستعلامات

| # | الجدول/الغرض | عدد الاستعلامات |
|---|--------------|-----------------|
| 1 | app_settings | 4 |
| 2 | platform_admins | 6 |
| 3 | platform_admin_permissions | 4 |
| 4 | members | 6 |
| 5 | member_clubs | 5 |
| 6 | clubs | 6 |
| 7 | club_settings | 2 |
| 8 | club_social_links | 3 |
| 9 | club_courts | 3 |
| 10 | club_admin_users | 4 |
| 11 | club_admin_permissions | 2 |
| 12 | club_offers | 3 |
| 13 | club_bookings | 4 |
| 14 | club_accounting | 6 |
| 15 | club_tournament_types | 3 |
| 16 | matches | 5 |
| 17 | member_stats | 4 |
| 18 | tournament_summaries | 2 |
| 19 | audit_log | 5 |
| 20 | تقارير وإحصائيات | 9 |
| 21 | Purge (حذف بعد 3 أشهر) | 11 |

---

## استخدام الاستعلامات

### من التطبيق (queries.js)
```javascript
import { getClubs, getMembers, getStatsTotals, getAuditLog } from './db/queries.js'

const clubs = await getClubs()
const totals = await getStatsTotals()  // { clubs, members, matches }
```

### API الإحصائيات
```
GET https://playtix.app/api/init-db/stats
```
يعيد: `totals`, `topMembers`, `matchCounts`, `memberCounts`

### phpMyAdmin
- استنساخ الاستعلامات من `queries.sql`
- استبدال `?` بالمعاملات الفعلية

---

## ملاحظات

- كل الجداول تدعم الحذف المؤقت (`deleted_at`, `deleted_by`)
- استخدم `WHERE deleted_at IS NULL` لجلب السجلات النشطة فقط
- Purge يشغّل دورياً لحذف السجلات المحذوفة منذ 3 أشهر
