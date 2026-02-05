# هيكل قاعدة البيانات - PlayTix (u502561206_padel_db)

**كل مدخلات النظام تُخزَّن وتُقرأ من قاعدة البيانات `u502561206_padel_db` (MySQL) فقط.**  
لا يوجد مصدر بيانات آخر — قاعدة البيانات هي المصدر الوحيد.

---

## الجداول والحقول لكل مدخلات النظام

### 1. `entities` — الأندية، الأعضاء، مدراء المنصة
| الحقل       | النوع        | الوصف                          |
|------------|--------------|--------------------------------|
| id         | INT          | مفتاح تلقائي                   |
| entity_type| VARCHAR(50)  | نوع الكيان: club, member, platform_admin |
| entity_id  | VARCHAR(255) | معرف فريد (مثل id النادي)      |
| data       | JSON         | بيانات الكيان الكاملة          |
| created_at | DATETIME     | تاريخ الإنشاء                  |
| updated_at | DATETIME     | تاريخ آخر تحديث                |

#### entity_type = 'club' — كل مدخلات الأندية
| الحقل | الجدول/الحقل | القسم/الصفحة |
|-------|--------------|---------------|
| id, name, nameAr | entities.data | الإعدادات الأساسية |
| logo, banner | entities.data | الإعدادات الأساسية |
| tagline, taglineAr, address, addressAr | entities.data | الإعدادات الأساسية |
| phone, email, website | entities.data | الإعدادات الأساسية |
| playtomicVenueId, playtomicApiKey | entities.data | Playtomic |
| courts | entities.data | الملاعب |
| settings.defaultLanguage, timezone, currency | entities.data | الإعدادات العامة |
| settings.bookingDuration, maxBookingAdvance, cancellationPolicy | entities.data | الحجز |
| settings.openingTime, closingTime | entities.data | ساعات العمل |
| settings.headerBgColor, headerTextColor | entities.data | ألوان الهيدر |
| settings.heroBgColor, heroBgOpacity, heroTitleColor, heroTextColor, heroStatsColor | entities.data | ألوان البطاقة |
| settings.socialLinks | entities.data | السوشيال ميديا |
| members | entities.data | الأعضاء |
| bookings | entities.data | الحجوزات |
| offers | entities.data | العروض |
| accounting | entities.data | المحاسبة |
| adminUsers | entities.data | مدراء النادي |
| tournamentTypes | entities.data | أنواع البطولات |
| storeEnabled, store | entities.data | المتجر (categories, products, sales, inventoryMovements, offers, coupons) |
| tournamentData | entities.data | بيانات البطولة (kingState, socialState, currentTournamentId, activeTab, contentTab, memberTab) |

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
⚠️ يحذف كل البيانات ويُنشئ: entities (hala-padel + platform_admin)، app_store، app_settings

**إضافة الملاعب الناقصة للنوادي الموجودة:**
```
https://playtix.app/api/init-db/migrate-club-settings
```

أو POST:

```powershell
Invoke-RestMethod -Uri "https://playtix.app/api/init-db" -Method POST
```

---

راجع `docs/ADMIN_PAGES_DB_MAPPING.md` لتفاصيل ربط كل صفحة إدارة بالجداول.
