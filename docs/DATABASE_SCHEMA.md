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

### 2. `app_settings` — الإعدادات والمتغيرات
| الحقل     | النوع       | الوصف                |
|----------|-------------|----------------------|
| key      | VARCHAR(255)| مفتاح الإعداد        |
| value    | JSON        | القيمة               |
| updated_at | DATETIME  | تاريخ آخر تحديث      |

**المفاتيح:** admin_settings, app_language, current_member_id, admin_current_club_id, bookings, password_reset_tokens

**ربط صفحات الإدارة:** راجع `docs/ADMIN_PAGES_DB_MAPPING.md` لتفاصيل ربط كل صفحة إدارة بالجداول.

### 3. `matches` — مباريات البطولات
| الحقل          | النوع  | الوصف          |
|----------------|--------|----------------|
| club_id        | VARCHAR| معرف النادي    |
| tournament_type| VARCHAR| نوع البطولة    |
| tournament_id  | INT    | معرف البطولة   |
| data           | JSON   | بيانات المباراة|
| saved_at       | BIGINT | وقت الحفظ      |

### 4. `member_stats` — إحصائيات الأعضاء
| الحقل        | النوع  | الوصف       |
|-------------|--------|-------------|
| club_id     | VARCHAR| معرف النادي |
| member_id   | VARCHAR| معرف العضو  |
| tournament_id| INT   | معرف البطولة|
| data        | JSON   | الإحصائيات  |

### 5. `tournament_summaries` — ملخصات البطولات
| الحقل   | النوع  | الوصف       |
|--------|--------|-------------|
| club_id| VARCHAR| معرف النادي |
| data   | JSON   | الملخص      |

### 6. `app_store` — (قديم، للتوافق)
يُستخدم للترحيل من النسخ القديمة. النظام الحالي يعتمد على `entities` و `app_settings`.

---

## مسار البيانات

1. **القراءة:** الواجهة الأمامية ← API `/api/data` ← جدولَي `entities` و `app_settings`
2. **الكتابة:** الواجهة الأمامية ← API `/api/data` ← جدولَي `entities` و `app_settings`
3. **تهيئة:** `POST /api/init-db` لإنشاء الجداول وترحيل بيانات `app_store` إذا وُجدت

---

## تهيئة قاعدة البيانات

```powershell
Invoke-RestMethod -Uri "http://localhost:4000/api/init-db" -Method POST
```

أو على Hostinger:

```powershell
Invoke-RestMethod -Uri "https://your-domain.com/api/init-db" -Method POST
```
