# هيكل قاعدة البيانات - PlayTix

**كل بيانات النظام تُخزَّن وتُقرأ من قاعدة البيانات `padel_db` (MySQL) فقط.**  
لا يوجد مصدر بيانات آخر — padel_db هي المصدر الوحيد.

---

## الجداول (داخل padel_db)

### 1. `entities` — الأندية، الأعضاء، مدراء المنصة
| الحقل       | النوع        | الوصف                          |
|------------|--------------|--------------------------------|
| id         | INT          | مفتاح تلقائي                   |
| entity_type| VARCHAR(50)  | نوع الكيان: club, member, platform_admin |
| entity_id  | VARCHAR(255) | معرف فريد (مثل id النادي)      |
| data       | JSON         | بيانات الكيان الكاملة          |
| created_at | DATETIME     | تاريخ الإنشاء                  |
| updated_at | DATETIME     | تاريخ آخر تحديث                |

#### هيكل كائن النادي (club) في data — Club Settings وجميع الأقسام
| الحقل | الوصف |
|-------|-------|
| id | معرف النادي |
| name, nameAr | الاسم (إنجليزي، عربي) |
| logo, banner | شعار وبنر النادي (URL أو base64) |
| tagline, taglineAr | وصف قصير |
| address, addressAr | العنوان |
| phone, email, website | التواصل |
| playtomicVenueId, playtomicApiKey | تكامل Playtomic |
| courts | مصفوفة الملاعب: [{ id, name, nameAr, type, maintenance, image }] |
| settings | إعدادات النادي (انظر أدناه) |
| tournaments | البطولات |
| members | الأعضاء |
| bookings | الحجوزات |
| offers | العروض |
| accounting | المحاسبة |
| adminUsers | مدراء النادي |
| tournamentTypes | أنواع البطولات |
| storeEnabled, store | المتجر (categories, products, sales, ...) |
| tournamentData | بيانات البطولة الحالية |

#### settings (داخل club.data)
| الحقل | الوصف |
|-------|-------|
| defaultLanguage | اللغة الافتراضية |
| timezone | المنطقة الزمنية |
| currency | العملة |
| bookingDuration | مدة الحجز (دقيقة) |
| maxBookingAdvance | أيام الحجز المسبق |
| cancellationPolicy | ساعات الإلغاء |
| openingTime, closingTime | ساعات العمل |
| headerBgColor, headerTextColor | ألوان الهيدر |
| heroBgColor, heroBgOpacity | خلفية البطاقة فوق البنر |
| heroTitleColor, heroTextColor, heroStatsColor | ألوان النص |
| socialLinks | [{ platform, url }] روابط السوشيال ميديا |

### 2. `app_settings` — الإعدادات والمتغيرات
| الحقل     | النوع       | الوصف                |
|----------|-------------|----------------------|
| key      | VARCHAR(255)| مفتاح الإعداد        |
| value    | JSON        | القيمة               |
| updated_at | DATETIME  | تاريخ آخر تحديث      |

**المفاتيح:** admin_settings, app_language, current_member_id, admin_current_club_id, bookings, password_reset_tokens

### 3. `matches` — مباريات البطولات
### 4. `member_stats` — إحصائيات الأعضاء
### 5. `tournament_summaries` — ملخصات البطولات
### 6. `app_store` — (قديم، للتوافق)

---

## تهيئة قاعدة البيانات

```powershell
Invoke-RestMethod -Uri "https://playtix.app/api/init-db?init=1"
```

أو POST:

```powershell
Invoke-RestMethod -Uri "https://playtix.app/api/init-db" -Method POST
```

---

راجع `docs/ADMIN_PAGES_DB_MAPPING.md` لتفاصيل ربط كل صفحة إدارة بالجداول.
