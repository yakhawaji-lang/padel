# إضافة وقت الاستعداد في قاعدة البيانات

## الجدول والحقل

**الجدول:** `club_settings`  
**الحقل:** `preparation_time_minutes`  
**النوع:** `INT`  
**الافتراضي:** `0`  
**الوصف:** فترة بالدقائق بعد كل حجز قبل بدء الحجز التالي (وقت تهيئة الملعب).

---

## ملفات SQL ذات الصلة

| الملف | الوصف |
|-------|--------|
| `server/db/migrations/add-preparation-time-minutes.sql` | Migration لإضافة العمود في قاعدة موجودة |
| `server/db/CREATE_ALL_TABLES.sql` | جدول club_settings (يتضمن العمود في التثبيت الجديد) |

---

## Migration يدوي (قاعدة موجودة)

نفّذ في MySQL / MariaDB:

```sql
ALTER TABLE club_settings ADD COLUMN preparation_time_minutes INT DEFAULT 0;
```

---

## ربط البيانات مع الواجهة

| قاعدة البيانات (snake_case) | الواجهة (camelCase) |
|---------------------------|---------------------|
| `preparation_time_minutes` | `preparationTimeMinutes` |

---

## مواضع الاستخدام في الكود

- **Frontend:** `src/admin/pages/ClubSettings.jsx` – نموذج الإعدادات
- **Frontend:** `src/pages/ClubPublicPage.jsx` – منطق الحجز والعرض
- **Backend:** `server/db/normalizedData.js` – القراءة والحفظ في padel_db
