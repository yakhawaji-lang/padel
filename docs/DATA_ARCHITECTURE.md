# هيكلة البيانات ومصادر الحقيقة — PlayTix / padel_db

## 1. مصدر الحقيقة الوحيد (Single Source of Truth)

| البيانات | مصدر القراءة | مصدر الكتابة |
|----------|--------------|--------------|
| **العضويات (member_clubs)** | `getMembersFromNormalized()` ← `member_clubs` + `members` | فقط: `POST /api/clubs/join`، `POST /api/data/member-remove-from-club`، أو دمج آمن في `saveMembersToNormalized` / `saveClubsToNormalized` |
| **الحسابات (members)** | `getMembersFromNormalized()` | `saveMembersToNormalized()` (دمج مع الحالي)، أو إنشاء العضو عند الانضمام من `POST /api/clubs/join` |
| **الحجوزات (club_bookings)** | `getClubsFromNormalized()` ← يجمع `club_bookings` مع النادي | فقط: `POST /api/bookings/confirm` (إنشاء)، أو `saveClubsToNormalized` عند حذف من القائمة (soft delete) |
| **النوادي (clubs + club_*)** | `getClubsFromNormalized()` | `saveClubsToNormalized()` مع حماية: عدم مسح عضويات النادي إذا الطلب أتى بقائمة أعضاء فارغة |

---

## 2. قواعد البيانات الأساسية (padel_db)

### 2.1 الجداول الحرجة

- **members** — حسابات الأعضاء (id, name, email, password_hash, mobile, …).
- **member_clubs** — ربط many-to-many بين عضو ونادي؛ **مصدر الحقيقة للعضوية**.
- **clubs** — النوادي.
- **club_settings** — إعدادات النادي (أوقات، أسعار حجز، lock_minutes، …).
- **club_bookings** — حجوزات الملاعب (id, club_id, court_id, member_id, booking_date, start_time, end_time, status, total_amount, …).
- **booking_slot_locks** — أقفال مؤقتة للشريحة قبل التأكيد.
- **booking_payment_shares** — مشاركات الدفع للحجز.

### 2.2 التتبع والحماية

- **العضويات:** لا تُحذف من `member_clubs` إلا عبر:
  - `POST /api/data/member-remove-from-club` (إزالة صريحة)، أو
  - حذف العضو/النادي نهائياً.
- عند `saveClubsToNormalized`: إذا كانت قائمة أعضاء النادي في الطلب **فارغة** وفي DB يوجد أعضاء للنادي → **لا يتم مسح** `member_clubs` لهذا النادي.
- عند `saveMembersToNormalized`: دمج `clubIds` من الطلب مع الحالي من DB؛ لا استبدال كامل يمسح عضويات غير مرسلة.

---

## 3. مسارات الكتابة والقراءة

### 3.1 الانضمام للنادي

1. الواجهة: `POST /api/clubs/join` { clubId, memberId }.
2. الخادم: التحقق من وجود النادي والعضو (أو إنشاء العضو من app_store إن لزم)، ثم `INSERT IGNORE INTO member_clubs`.
3. بعد النجاح: الواجهة تستدعي `refreshClubsFromApi()` و`addMemberToClub` محلياً ثم حفظ الأعضاء لمواءمة الكاش.

### 3.2 الحجز (من القفل إلى التأكيد)

1. **قفل:** `POST /api/bookings/lock` → إدراج في `booking_slot_locks`.
2. **تأكيد:** `POST /api/bookings/confirm` → إدراج في `club_bookings`، ربط القفل بالحجز، إلغاء القفل.
3. **القراءة:** `GET /api/data?keys=admin_clubs` → `getClubsFromNormalized()` يقرأ `club_bookings` ويربطها بكل نادي.

### 3.3 حذف حجز

- من الواجهة: `deleteBookingFromClub(clubId, bookingId)` يعدّل قائمة `bookings` في الكائن المحلي ثم `saveClubs`.
- الخادم: `saveClubsToNormalized` يحدّث الحجوزات (soft delete في `club_bookings`) مع **حماية عضويات النادي** (عدم المسح عند قائمة أعضاء فارغة).

---

## 4. التحديث والمتابعة بعد الإجراءات

- بعد **الانضمام:** `refreshClubsFromApi()` ثم `setPlatformUser(getCurrentPlatformUser())` و`refreshClub()`.
- بعد **تأكيد الحجز:** `refreshClubsFromApi()` ثم `loadClubs()` و`setClub(getClubById(clubId))` و`refreshClub()`.
- عند **تحميل الصفحة (F5):** `bootstrap()` → `getStoreBatch(['admin_clubs','all_members','padel_members'])` → **فقط من `/api/data`** (لا fallback إلى `/api/store` لمفاتيح النوادي/الأعضاء) حتى لا تُستبدل البيانات ببيانات قديمة من `app_store`.

---

## 5. فحص السلامة (Integrity)

- التحقق من أن كل صف في `member_clubs` له `member_id` موجود في `members` و`club_id` موجود في `clubs`.
- التحقق من أن كل صف في `club_bookings` له `club_id` موجود في `clubs`.
- **سكريبت:** من جذر المشروع: `node server/scripts/db-integrity-check.js`
- **واجهة برمجية:** `GET http://localhost:4000/api/health/integrity` تُرجع `{ ok, issues, checks }`.

---

## 6. طبقة الخدمات (Services)

- **العضويات:** كل الكتابة على `member_clubs` تتم عبر `server/services/membershipService.js` (addMemberToClub، removeMemberFromClub، setMemberClubs، setClubMembers، إلخ). المستدعيات: انضمام نادي، حفظ أعضاء/نوادي، إزالة عضو من نادي، سكربت relink، sync-member-clubs.
- **الحجوزات:** إنشاء/إلغاء/تحديث حالة الحجز تتم عبر `server/services/bookingService.js` (createBooking، cancelBooking، updateBookingPayment، expireUnpaidBookings). المستدعيات: تأكيد حجز، إلغاء، تسجيل دفعة، mark-pay-at-club، و job انتهاء الحجوزات غير المدفوعة.
- وثيقة عمليات بالعربية: `docs/OPERATIONS_AR.md`.

---

## 7. الأداء والاستقرار

- فهارس موصى بها: `member_clubs (club_id)`، مركّب لـ `club_bookings (club_id, booking_date)` و`booking_slot_locks (club_id, booking_date, expires_at)`. تنفيذ إن لزم: `server/db/migrations/add-recommended-indexes.sql` في phpMyAdmin (تجاهل "Duplicate key").
- عدم الاعتماد على `app_store` لبيانات النوادي/الأعضاء/الحجوزات عند وجود الجداول المنظمة؛ القراءة والكتابة عبر `/api/data` والطبقة المعيارية فقط.
