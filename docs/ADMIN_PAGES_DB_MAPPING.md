# ربط صفحات الإدارة بقاعدة البيانات padel_db

**كل بيانات النظام تُخزَّن داخل قاعدة البيانات `padel_db`.**  
لا يوجد تخزين محلي (localStorage) كمصدر أساسي — قاعدة البيانات هي المصدر الوحيد للبيانات.

---

## قاعدة البيانات padel_db

جميع الجداول التالية موجودة داخل **padel_db**:

| الجدول | الاستخدام |
|--------|-----------|
| `entities` | الأندية (club)، الأعضاء (member)، مدراء المنصة (platform_admin) |
| `app_settings` | الإعدادات، اللغة، الحجوزات، رموز استعادة كلمة المرور |
| `app_store` | (قديم) يُستخدم للترحيل وكرصيد عند فشل `/api/data` |
| `matches` | مباريات البطولات |
| `member_stats` | إحصائيات الأعضاء في البطولات |
| `tournament_summaries` | ملخصات البطولات |

---

## مسار البيانات (كلها → padel_db)

1. **الواجهة الأمامية** ← `backendStorage` / `adminStorage` ← **API `/api/data`** ← **padel_db** (جداول entities و app_settings)
2. عند فشل `/api/data`: تراجع إلى `/api/store` ← **padel_db** (جدول app_store)

---

## ربط الصفحات

### 1. `/app/admin/all-clubs` — لوحة جميع الأندية (AllClubsDashboard)

| البيانات | المصدر | الجدول (padel_db) |
|------------------|--------|---------------|
| الأندية | `loadClubs()` | `entities` (entity_type='club') |
| إجمالي الأعضاء | `getAllMembersFromStorage()` | `entities` (entity_type='member') |
| إحصائيات كل نادٍ (ملاعب، أعضاء، بطولات، إيرادات) | داخل كائن النادي | `entities.data` (JSON للنادي) |
| طلبات قيد المراجعة | `clubs` المفلترة (status='pending') | `entities` (club) |
| إنشاء/موافقة/رفض نادي | `onApproveClub`, `onRejectClub`, `saveClubs` | `entities` (club) |

### 2. `/app/admin/admin-users` — مدراء المنصة والأندية (AdminUsersManagement)

| البيانات | المصدر | الجدول (padel_db) |
|------------------|--------|---------------|
| مدراء المنصة | `loadPlatformAdmins()` | `entities` (entity_type='platform_admin') |
| مدراء النوادي | `club.adminUsers` | داخل `entities.data` للنادي (club) |
| مالك النادي | `club.owner` | داخل `entities.data` للنادي |
| إضافة/تعديل/حذف مدير | `addPlatformAdmin`, `updatePlatformAdmin`, `removePlatformAdmin` | `entities` (platform_admin) |
| ربط مدير بنادي | `onUpdateClub(clubId, { adminUsers })` | `entities` (club) |

### 3. `/app/admin/manage-clubs` — إدارة الأندية (AllClubsManagement)

| البيانات | المصدر | الجدول (padel_db) |
|------------------|--------|---------------|
| قائمة الأندية | `clubs` من `useAdminPanel()` | `entities` (club) |
| عدد الأعضاء لكل نادٍ | `getClubMembersFromStorage(clubId)` | `entities` (member) + club.members |
| إنشاء نادٍ | `onCreateClub` → `saveClubs` | `entities` (club) |
| تعديل نادٍ | `onUpdateClub` → `saveClubs` | `entities` (club) |
| حذف نادٍ | `onDeleteClub` → `saveClubs` | `entities` (club) |
| مزامنة الأعضاء | `syncMembersToClubsManually` | `entities` (member + club) |

### 4. `/app/admin/all-members` — أعضاء كل الأندية (AllMembersManagement)

| البيانات | المصدر | الجدول (padel_db) |
|------------------|--------|---------------|
| قائمة الأعضاء | `getAllMembersFromStorage()` | `entities` (entity_type='member') |
| النوادي المنضم لها | `member.clubIds` | داخل `entities.data` للعضو |
| إضافة عضو لنادي | `addMemberToClub` → `saveMembers` | `entities` (member) |
| تعديل عضو | `upsertMember` → `saveMembers` | `entities` (member) |
| حذف عضو | `deleteMember` → `saveMembers` | `entities` (member) |

---

## المفاتيح ومعادلتها في padel_db

| مفتاح التخزين | الجدول (داخل padel_db) | ملاحظات |
|---------------|-------------------------|---------|
| `admin_clubs` | `entities` (entity_type='club') | كل نادٍ = صف واحد، يشمل courts, bookings, offers, store, accounting |
| `all_members` | `entities` (entity_type='member') | كل عضو = صف واحد |
| `padel_members` | `entities` (entity_type='member') | نفس بيانات all_members |
| `platform_admins` | `entities` (entity_type='platform_admin') | كل مدير = صف واحد |
| `admin_settings` | `app_settings` | إعدادات عامة |
| `app_language` | `app_settings` | اللغة المختارة |
| `current_member_id` | `app_settings` | العضو المسجل |
| `admin_current_club_id` | `app_settings` | النادي المختار في لوحة المنصة |
| `platform_admin_session` | `app_settings` | جلسة مدير المنصة |
| `club_admin_session` | `app_settings` | جلسة مدير النادي |
| `current_club_admin_id` | `app_settings` | النادي الذي يديره المدير |
| `club_{clubId}_language` | `app_settings` | لغة واجهة النادي (مفتاح ديناميكي) |
| `password_reset_tokens` | `app_settings` | رموز استعادة كلمة المرور |

---

## الشروط لاستخدام قاعدة البيانات

1. **`VITE_USE_POSTGRES`** يجب ألا يكون `'false'` (القيمة الافتراضية تُفعّل الاتصال بالـ API وقاعدة البيانات).
2. **`DATABASE_URL`** في ملف `.env` على الخادم: `mysql://user:pass@host/dbname`
3. تشغيل **`POST /api/init-db`** مرة واحدة لتهيئة الجداول والترحيل من app_store إن وُجد.

---

## صفحات تحكم النادي (Club Admin)

جميع صفحات تحكم النادي (`/app/admin/club/:clubId/...`) تعتمد على بيانات تُحمَّل من **padel_db**.  
بيانات النادي والملاعب والعروض والمحاسبة والأعضاء تُخزَّن في **padel_db** عبر `saveClubs` و `saveMembers`.

| الصفحة | البيانات | الحقل في club |
|--------|----------|---------------|
| dashboard | نظرة عامة، إحصائيات | club.* (tournaments, members, bookings, accounting, courts, offers) |
| members | الأعضاء | club.members + getClubMembersFromStorage (من entities member) |
| offers | العروض | club.offers |
| store | المتجر، المنتجات، المبيعات | club.store (categories, products, sales, inventoryMovements, offers, coupons) |
| accounting | المحاسبة | club.accounting |
| settings | الإعدادات، الملاعب، الساعات، السوشيال | club.* (name, nameAr, logo, banner, courts, settings: defaultLanguage, timezone, currency, bookingDuration, maxBookingAdvance, cancellationPolicy, openingTime, closingTime, headerBgColor, headerTextColor, heroBgColor, heroBgOpacity, heroTitleColor, heroTextColor, heroStatsColor, socialLinks) — **الملاعب**: حفظ فوري عند إضافة/تعديل/حذف/تبديل صيانة |
| users | مدراء النادي | club.adminUsers, club.owner |

---

## التحقق

```powershell
# فحص الاتصال بقاعدة البيانات
Invoke-RestMethod -Uri "http://localhost:4000/api/health"

# تهيئة قاعدة البيانات (مرة واحدة)
Invoke-RestMethod -Uri "http://localhost:4000/api/init-db" -Method POST

# إنشاء مدير افتراضي (2@2.com / 123456) إن لم يُوجد
Invoke-RestMethod -Uri "http://localhost:4000/api/init-db/seed-platform-owner" -Method POST
```
