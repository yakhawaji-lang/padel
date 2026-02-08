# هيكل قاعدة البيانات - PlayTix (u502561206_padel_db)

**كل مدخلات النظام تُخزَّن وتُقرأ من قاعدة البيانات `u502561206_padel_db` (MySQL) فقط.**  
لا localStorage، لا IndexedDB، لا JSON في التخزين — MySQL هو المصدر الوحيد.

## الملفات
- `server/db/schema-relational.sql` — هيكل علائقي كامل بدون أعمدة JSON
- `server/db/queries.sql` — استعلامات شاملة لكل بيانات النظام
- `docs/QUERIES.md` — فهرس الاستعلامات

---

## الجداول المنظمة (المصدر الرئيسي بعد الترحيل)

بعد تشغيل `/api/init-db/migrate-to-normalized`، يُستخدم الهيكل التالي:

| الجدول | الوصف | العلاقات |
|--------|-------|----------|
| `platform_admins` | مدراء المنصة | - |
| `members` | الأعضاء | member_clubs |
| `clubs` | الأندية | - |
| `member_clubs` | علاقة many-to-many بين الأعضاء والنوادي | member_id → members, club_id → clubs |
| `club_courts` | الملاعب | club_id → clubs |
| `club_settings` | إعدادات النادي | club_id → clubs |
| `club_admin_users` | مدراء النادي | club_id → clubs |
| `club_offers` | العروض | club_id → clubs |
| `club_bookings` | الحجوزات | club_id → clubs |
| `club_accounting` | المحاسبة | club_id → clubs |
| `club_tournament_types` | أنواع البطولات | club_id → clubs |
| `club_store` | بيانات المتجر (JSON) | club_id → clubs |
| `audit_log` | سجل التدقيق (من قام بماذا ومتى) | - |

**الحذف المؤقت (Soft Delete):** كل جدول يحتوي على `deleted_at`, `deleted_by`. الحذف = تعبئة هذه الحقول، ولا يُحذف السجل نهائياً إلا بعد 3 أشهر عبر `/api/init-db/purge-soft-deleted`.

**التدقيق (Audit):** يتم تسجيل كل عملية INSERT/UPDATE/DELETE في `audit_log` مع معرف المدخل (X-Actor-Type, X-Actor-Id) من الـ API.

---

## الجداول القديمة (للمرحمة)

### 1. `entities` — (يُستخدم عند عدم وجود جداول منظمة)
| الحقل       | النوع        | الوصف                          |
|------------|--------------|--------------------------------|
| id         | INT          | مفتاح تلقائي                   |
| entity_type| VARCHAR(50)  | نوع الكيان: club, member, platform_admin |
| entity_id  | VARCHAR(255) | معرف فريد (مثل id النادي)      |
| data       | JSON         | بيانات الكيان الكاملة          |
| created_at | DATETIME     | تاريخ الإنشاء                  |
| updated_at | DATETIME     | تاريخ آخر تحديث                |

#### entity_type = 'club' — كل مدخلات الأندية (حفظ فوري للملاعب)
| الحقل | الجدول/الحقل | القسم/الصفحة | ملاحظة الحفظ |
|-------|--------------|---------------|---------------|
| id, name, nameAr | entities.data | الإعدادات الأساسية | Save Settings (زر الحفظ) |
| logo, banner | entities.data | الإعدادات الأساسية | Save Settings |
| tagline, taglineAr, address, addressAr | entities.data | الإعدادات الأساسية | Save Settings |
| phone, email, website | entities.data | الإعدادات الأساسية | Save Settings |
| playtomicVenueId, playtomicApiKey | entities.data | Playtomic | Save Settings |
| courts | entities.data | الملاعب | **فوري** (إضافة/تعديل/حذف/صيانة) |
| settings.defaultLanguage, timezone, currency | entities.data | الإعدادات العامة | Save Settings |
| settings.bookingDuration, maxBookingAdvance, cancellationPolicy | entities.data | الحجز | Save Settings |
| settings.openingTime, closingTime | entities.data | ساعات العمل | Save Settings |
| settings.headerBgColor, headerTextColor | entities.data | ألوان الهيدر | Save Settings |
| settings.heroBgColor, heroBgOpacity, heroTitleColor, heroTextColor, heroStatsColor | entities.data | ألوان البطاقة | Save Settings |
| settings.socialLinks | entities.data | السوشيال ميديا | Save Settings |
| settings.bookingPrices | club_settings.booking_prices | أسعار الحجوزات (المدة، الأيام، الوقت، المواسم) | Save Booking Prices |
| members | entities.data | الأعضاء | saveMembers (فوري) |
| bookings | entities.data | الحجوزات | onUpdateClub |
| offers | entities.data | العروض | onUpdateClub (فوري) |
| accounting | entities.data | المحاسبة | onUpdateClub (فوري) |
| adminUsers | entities.data | مدراء النادي | onUpdateClub (فوري) |
| tournamentTypes | entities.data | أنواع البطولات | onUpdateClub |
| storeEnabled, store | entities.data | المتجر (categories, products, sales, inventoryMovements, offers, coupons) | onUpdateClub (فوري) |
| tournamentData | entities.data | بيانات البطولة (kingState, socialState, currentTournamentId, activeTab, contentTab, memberTab) | حفظ تلقائي |

#### entity_type = 'member'
| الحقل | الوصف |
|-------|-------|
| id, name, nameAr, email, avatar | بيانات العضو |
| clubIds | الأندية المنضم لها |
| totalPoints, totalGames, totalWins, pointsHistory | إحصائيات |

#### entity_type = 'platform_admin'
| الحقل | الوصف |
|-------|-------|
| id, email, password, role | مدير المنصة |
| permissions | الصلاحيات |

### 2. `app_settings` — الإعدادات العامة والجلسات
| key | الوصف | الصفحة/القسم |
|-----|-------|---------------|
| admin_settings | إعدادات المنصة | لوحة المنصة |
| app_language | لغة التطبيق | جميع الصفحات |
| current_member_id | العضو المسجل حالياً | تسجيل الدخول |
| admin_current_club_id | النادي المختار في لوحة المنصة | AllClubsDashboard |
| platform_admin_session | جلسة مدير المنصة | PlatformAdminLogin |
| club_admin_session | جلسة مدير النادي | ClubLogin |
| current_club_admin_id | النادي الذي يديره المدير | ClubAdminPanel |
| club_{clubId}_language | لغة واجهة النادي | ClubSettings, ClubDashboard |
| password_reset_tokens | رموز استعادة كلمة المرور | ForgotPassword |

### 3. `matches` — مباريات البطولات
| الحقل | النوع | الوصف |
|-------|-------|-------|
| club_id | VARCHAR | معرف النادي |
| tournament_type | VARCHAR | king / social |
| tournament_id | INT | معرف البطولة |
| data | JSON | بيانات المباراة |
| saved_at | BIGINT | الطابع الزمني |

### 4. `member_stats` — إحصائيات الأعضاء
| الحقل | الوصف |
|-------|-------|
| club_id, member_id, tournament_id | المفاتيح |
| data | JSON إحصائيات العضو |

### 5. `tournament_summaries` — ملخصات البطولات
| الحقل | الوصف |
|-------|-------|
| club_id | معرف النادي |
| data | JSON ملخص البطولة |

### 6. `app_store` — (للمرحمة من نسخ قديمة)

---

## تهيئة قاعدة البيانات u502561206_padel_db

**التهيئة الأولى (إنشاء الجداول والقيم الافتراضية):**
```
https://playtix.app/api/init-db?init=1
```
أو من PowerShell:
```powershell
Invoke-RestMethod -Uri "https://playtix.app/api/init-db?init=1"
```

**إعادة تهيئة كاملة (حذف جميع البيانات وإعادة الإنشاء):**
```
https://playtix.app/api/init-db?reset=1
```
⚠️ يحذف كل البيانات ويُنشئ: مستخدم Super Admin واحد فقط (admin@playtix.app)، بدون نوادي افتراضية

**إضافة الملاعب الناقصة للنوادي الموجودة:**
```
https://playtix.app/api/init-db/migrate-club-settings
```

**الترحيل إلى الجداول المنظمة:**
```
https://playtix.app/api/init-db/migrate-to-normalized
```
ينشئ الجداول المنظمة وينسخ البيانات من `entities`.

**حذف السجلات المحذوفة (بعد 3 أشهر):**
```
https://playtix.app/api/init-db/purge-soft-deleted
```
يُنصح بتشغيلها دورياً (Cron يومي).

أو POST:
```powershell
Invoke-RestMethod -Uri "https://playtix.app/api/init-db" -Method POST
```

---

راجع `docs/ADMIN_PAGES_DB_MAPPING.md` لتفاصيل ربط كل صفحة إدارة بالجداول.
